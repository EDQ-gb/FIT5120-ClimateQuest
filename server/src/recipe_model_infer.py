import argparse
import json
import math
import re
from pathlib import Path

import torch
import torch.nn as nn
import torch.nn.functional as F


PAD_token = 0
SOS_token = 1
EOS_token = 2
UNK_token = 3
SPECIAL_TOKENS = ["<PAD>", "<SOS>", "<EOS>", "<UNK>"]
MAX_OUTPUT_LEN = 160


def tokenize_text(text):
    return re.findall(r"\w+|[^\w\s]", str(text).lower().strip())


class PositionalEncoding(nn.Module):
    def __init__(self, d_model, dropout=0.1, max_len=2048):
        super().__init__()
        self.dropout = nn.Dropout(dropout)
        position = torch.arange(max_len).unsqueeze(1)
        div_term = torch.exp(torch.arange(0, d_model, 2) * (-math.log(10000.0) / d_model))
        pe = torch.zeros(max_len, d_model)
        pe[:, 0::2] = torch.sin(position * div_term)
        pe[:, 1::2] = torch.cos(position * div_term)
        self.register_buffer("pe", pe.unsqueeze(0))

    def forward(self, x):
        x = x + self.pe[:, : x.size(1)]
        return self.dropout(x)


class CopyTransformerDecoderLayer(nn.Module):
    def __init__(self, d_model, nhead, dim_feedforward=1024, dropout=0.1):
        super().__init__()
        self.self_attn = nn.MultiheadAttention(d_model, nhead, dropout=dropout, batch_first=True)
        self.cross_attn = nn.MultiheadAttention(d_model, nhead, dropout=dropout, batch_first=True)
        self.linear1 = nn.Linear(d_model, dim_feedforward)
        self.linear2 = nn.Linear(dim_feedforward, d_model)
        self.norm1 = nn.LayerNorm(d_model)
        self.norm2 = nn.LayerNorm(d_model)
        self.norm3 = nn.LayerNorm(d_model)
        self.dropout = nn.Dropout(dropout)
        self.dropout1 = nn.Dropout(dropout)
        self.dropout2 = nn.Dropout(dropout)
        self.dropout3 = nn.Dropout(dropout)

    def forward(self, tgt, memory, tgt_mask=None, tgt_key_padding_mask=None, memory_key_padding_mask=None):
        self_out, _ = self.self_attn(
            tgt, tgt, tgt,
            attn_mask=tgt_mask,
            key_padding_mask=tgt_key_padding_mask,
            need_weights=False,
        )
        tgt = self.norm1(tgt + self.dropout1(self_out))
        cross_out, cross_weights = self.cross_attn(
            tgt, memory, memory,
            key_padding_mask=memory_key_padding_mask,
            need_weights=True,
            average_attn_weights=False,
        )
        tgt = self.norm2(tgt + self.dropout2(cross_out))
        ff = self.linear2(self.dropout(F.gelu(self.linear1(tgt))))
        tgt = self.norm3(tgt + self.dropout3(ff))
        return tgt, cross_weights


class TransformerPointerGenerator(nn.Module):
    def __init__(
        self,
        input_vocab_size,
        output_vocab_size,
        d_model=256,
        nhead=8,
        num_encoder_layers=3,
        num_decoder_layers=3,
        dim_feedforward=1024,
        dropout=0.1,
    ):
        super().__init__()
        self.output_vocab_size = output_vocab_size
        self.d_model = d_model
        self.src_embedding = nn.Embedding(input_vocab_size, d_model, padding_idx=PAD_token)
        self.tgt_embedding = nn.Embedding(output_vocab_size, d_model, padding_idx=PAD_token)
        self.positional = PositionalEncoding(d_model, dropout)
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model,
            nhead=nhead,
            dim_feedforward=dim_feedforward,
            dropout=dropout,
            batch_first=True,
            activation="gelu",
        )
        self.encoder = nn.TransformerEncoder(encoder_layer, num_layers=num_encoder_layers, enable_nested_tensor=False)
        self.decoder_layers = nn.ModuleList(
            [CopyTransformerDecoderLayer(d_model, nhead, dim_feedforward, dropout) for _ in range(num_decoder_layers)]
        )
        self.vocab_proj = nn.Linear(d_model, output_vocab_size)
        self.p_gen_proj = nn.Linear(d_model * 3, 1)

    def forward(self, src, tgt_in, src_copy_ids, extended_vocab_size):
        src_padding = src.eq(PAD_token)
        tgt_padding = tgt_in.eq(PAD_token)
        tgt_mask = torch.triu(
            torch.ones(tgt_in.size(1), tgt_in.size(1), dtype=torch.bool, device=tgt_in.device),
            diagonal=1,
        )

        src_emb = self.positional(self.src_embedding(src) * math.sqrt(self.d_model))
        tgt_emb = self.positional(self.tgt_embedding(tgt_in) * math.sqrt(self.d_model))
        memory = self.encoder(src_emb, src_key_padding_mask=src_padding)

        dec = tgt_emb
        cross_weights = None
        for layer in self.decoder_layers:
            dec, cross_weights = layer(
                dec,
                memory,
                tgt_mask=tgt_mask,
                tgt_key_padding_mask=tgt_padding,
                memory_key_padding_mask=src_padding,
            )

        vocab_dist = F.softmax(self.vocab_proj(dec), dim=-1)
        if extended_vocab_size > self.output_vocab_size:
            extra = torch.zeros(
                vocab_dist.size(0),
                vocab_dist.size(1),
                extended_vocab_size - self.output_vocab_size,
                device=vocab_dist.device,
                dtype=vocab_dist.dtype,
            )
            vocab_dist = torch.cat([vocab_dist, extra], dim=-1)

        attn = cross_weights.mean(dim=1)
        attn = attn.masked_fill(src_padding.unsqueeze(1), 0.0)
        attn = attn / attn.sum(dim=-1, keepdim=True).clamp_min(1e-12)
        context = torch.bmm(attn, memory)

        p_gen = torch.sigmoid(self.p_gen_proj(torch.cat([dec, context, tgt_emb], dim=-1)))
        copy_dist = torch.zeros_like(vocab_dist)
        scatter_index = src_copy_ids.unsqueeze(1).expand(-1, tgt_in.size(1), -1)
        copy_dist.scatter_add_(dim=-1, index=scatter_index, src=attn)
        final_dist = p_gen * vocab_dist + (1 - p_gen) * copy_dist
        return final_dist.clamp_min(1e-12), p_gen, attn


def source_ids(tokens, input_lang):
    return [input_lang["word2index"].get(tok, UNK_token) for tok in tokens] + [EOS_token]


def source_copy_ids(tokens, output_lang):
    oov_list = []
    ids = []
    word2index = output_lang["word2index"]
    for tok in tokens:
        if tok in word2index:
            ids.append(word2index[tok])
        else:
            if tok not in oov_list:
                oov_list.append(tok)
            ids.append(output_lang["n_words"] + oov_list.index(tok))
    ids.append(EOS_token)
    return ids, oov_list


def decode_token(token_id, output_lang, oov_list):
    index2word = output_lang["index2word"]
    if token_id < output_lang["n_words"]:
        return index2word.get(token_id, index2word.get(str(token_id), "<UNK>"))
    idx = token_id - output_lang["n_words"]
    if 0 <= idx < len(oov_list):
        return oov_list[idx]
    return "<UNK>"


def normalize_generated_text(text):
    text = " ".join(text.split())
    return text.replace(" .", ".").replace(" ,", ",").replace(" ;", ";").strip()


def sentence_steps(text):
    parts = [p.strip(" ,;") for p in re.split(r"[.!?]+", text) if p.strip(" ,;")]
    steps = []
    seen = set()
    for part in parts:
        key = re.sub(r"[^a-z ]", "", part.lower()).strip()
        if not key or key in seen:
            continue
        seen.add(key)
        steps.append(part[:1].upper() + part[1:] + ".")
    return steps


def build_model(checkpoint, device):
    input_lang = checkpoint["input_lang"]
    output_lang = checkpoint["output_lang"]
    config = checkpoint.get("model_config") or {
        "d_model": 256,
        "nhead": 8,
        "num_encoder_layers": 3,
        "num_decoder_layers": 3,
        "dim_feedforward": 1024,
        "dropout": 0.15,
    }
    model = TransformerPointerGenerator(
        input_vocab_size=input_lang["n_words"],
        output_vocab_size=output_lang["n_words"],
        **config,
    )
    model.load_state_dict(checkpoint["model_state_dict"])
    model.to(device)
    model.eval()
    return model, input_lang, output_lang


@torch.no_grad()
def generate_beam(model, input_lang, output_lang, ingredients, device, max_len=110, min_len=18, beam_size=4):
    src_tokens = tokenize_text(ingredients)
    src = source_ids(src_tokens, input_lang)
    src_copy, oov_list = source_copy_ids(src_tokens, output_lang)
    src_tensor = torch.tensor([src], dtype=torch.long, device=device)
    src_copy_tensor = torch.tensor([src_copy], dtype=torch.long, device=device)
    extended_vocab_size = output_lang["n_words"] + len(oov_list)
    beams = [([SOS_token], 0.0, False)]

    for _ in range(max_len):
        candidates = []
        for token_ids, score, ended in beams:
            if ended:
                candidates.append((token_ids, score, True))
                continue
            decoder_ids = [tok if tok < output_lang["n_words"] else UNK_token for tok in token_ids]
            tgt_in = torch.tensor([decoder_ids], dtype=torch.long, device=device)
            final_dist, _, _ = model(src_tensor, tgt_in, src_copy_tensor, extended_vocab_size)
            probs = final_dist[0, -1].clone().clamp_min(1e-12)
            probs[PAD_token] = 1e-12
            probs[SOS_token] = 1e-12
            if len(token_ids) - 1 < min_len:
                probs[EOS_token] = 1e-12
            probs = probs / probs.sum()
            values, indices = torch.topk(torch.log(probs), min(probs.numel(), beam_size * 4))
            added = 0
            for log_prob, idx in zip(values.tolist(), indices.tolist()):
                if len(token_ids) >= 3 and tuple((token_ids + [idx])[-3:]) in {
                    tuple(token_ids[i : i + 3]) for i in range(len(token_ids) - 2)
                }:
                    continue
                candidates.append((token_ids + [idx], score + float(log_prob), idx == EOS_token))
                added += 1
                if added >= beam_size:
                    break
        if not candidates:
            break
        beams = sorted(candidates, key=lambda x: x[1] / (max(1, len(x[0]) - 1) ** 0.8), reverse=True)[:beam_size]
        if all(ended for _, _, ended in beams):
            break

    best_ids = sorted(beams, key=lambda x: x[1] / (max(1, len(x[0]) - 1) ** 0.8), reverse=True)[0][0]
    words = [
        decode_token(tok, output_lang, oov_list)
        for tok in best_ids
        if tok not in {PAD_token, SOS_token, EOS_token}
    ]
    words = [w for w in words if w not in SPECIAL_TOKENS]
    return normalize_generated_text(" ".join(words))


def default_checkpoint_path():
    return Path(__file__).resolve().parents[2] / "AI Development" / "Cooking_Dataset" / "best_transformer_copy_v2.pt"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ingredients", required=True)
    parser.add_argument("--checkpoint", default=str(default_checkpoint_path()))
    parser.add_argument("--device", default="auto")
    args = parser.parse_args()

    if args.device == "auto":
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    else:
        device = torch.device(args.device)

    checkpoint = torch.load(args.checkpoint, map_location=device, weights_only=False)
    model, input_lang, output_lang = build_model(checkpoint, device)
    text = generate_beam(model, input_lang, output_lang, args.ingredients, device)
    result = {
        "source": "transformer_copy_v2",
        "ingredients": [x.strip() for x in args.ingredients.split(",") if x.strip()],
        "title": "Generated low-carbon meal",
        "text": text,
        "steps": sentence_steps(text),
        "checkpointEpoch": checkpoint.get("epoch"),
        "bestDevLoss": checkpoint.get("best_dev_loss"),
        "device": str(device),
    }
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
