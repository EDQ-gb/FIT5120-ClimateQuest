import argparse
import json
import traceback

import torch

from recipe_model_infer import (
    build_model,
    default_checkpoint_path,
    generate_beam,
    sentence_steps,
)


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", default=str(default_checkpoint_path()))
    parser.add_argument("--device", default="auto")
    parser.add_argument("--beam-size", type=int, default=2)
    parser.add_argument("--max-len", type=int, default=80)
    parser.add_argument("--min-len", type=int, default=10)
    return parser.parse_args()


def normalize_ingredients(raw):
    if not isinstance(raw, list):
        return []
    out = []
    for x in raw:
        text = str(x or "").strip()
        if text:
            out.append(text)
    return out


def select_device(name):
    if name == "auto":
        return torch.device("cuda" if torch.cuda.is_available() else "cpu")
    return torch.device(name)


def emit(payload):
    print(json.dumps(payload, ensure_ascii=False), flush=True)


def main():
    args = parse_args()
    device = select_device(args.device)
    checkpoint = torch.load(args.checkpoint, map_location=device, weights_only=False)
    model, input_lang, output_lang = build_model(checkpoint, device)
    emit(
        {
            "ready": True,
            "source": "transformer_copy_v2",
            "device": str(device),
            "beamSize": int(args.beam_size),
            "maxLen": int(args.max_len),
            "minLen": int(args.min_len),
        }
    )

    for line in iter(input, ""):
        raw = line.strip()
        if not raw:
            continue
        req_id = None
        try:
            payload = json.loads(raw)
            req_id = payload.get("id")
            ingredients = normalize_ingredients(payload.get("ingredients"))
            if len(ingredients) < 3 or len(ingredients) > 5:
                emit(
                    {
                        "id": req_id,
                        "ok": False,
                        "error": "INGREDIENT_COUNT_MUST_BE_3_TO_5",
                    }
                )
                continue

            ingredients_text = ", ".join(ingredients)
            text = generate_beam(
                model,
                input_lang,
                output_lang,
                ingredients_text,
                device,
                max_len=max(20, int(args.max_len)),
                min_len=max(4, int(args.min_len)),
                beam_size=max(1, int(args.beam_size)),
            )
            emit(
                {
                    "id": req_id,
                    "ok": True,
                    "result": {
                        "source": "transformer_copy_v2",
                        "ingredients": ingredients,
                        "title": "Generated low-carbon meal",
                        "text": text,
                        "steps": sentence_steps(text),
                        "checkpointEpoch": checkpoint.get("epoch"),
                        "bestDevLoss": checkpoint.get("best_dev_loss"),
                        "device": str(device),
                    },
                }
            )
        except Exception as exc:
            emit(
                {
                    "id": req_id,
                    "ok": False,
                    "error": str(exc),
                    "detail": traceback.format_exc(limit=3)[-900:],
                }
            )


if __name__ == "__main__":
    main()
