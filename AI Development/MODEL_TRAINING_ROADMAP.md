# Recipe Generator Model Training Roadmap

This roadmap focuses on improving model quality before any frontend integration.

## Current Baseline

File: `code_32124112_spicy1.ipynb`

Current model:

- Transformer encoder-decoder
- Pointer-generator copy mechanism
- Full filtered train set: 155,248 samples
- Dev set: 1,005 samples
- Test set: 1,043 samples
- Batch size: 32
- Epochs: 12
- Learning rate: 3e-4
- Checkpoint: `Cooking_Dataset/best_spicy1_transformer_copy.pt`

Current training result:

| Epoch | Train Loss | Dev Loss |
| --- | ---: | ---: |
| 1 | 3.9889 | 2.7309 |
| 2 | 2.6552 | 2.4346 |
| 3 | 2.4729 | 2.3414 |
| 4 | 2.3818 | 2.2751 |
| 5 | 2.3189 | 2.2315 |
| 6 | 2.2702 | 2.2036 |
| 7 | 2.2296 | 2.1740 |
| 8 | 2.1963 | 2.1552 |
| 9 | 2.1686 | 2.1406 |
| 10 | 2.1485 | 2.1329 |
| 11 | 2.1356 | 2.1279 |
| 12 | 2.1283 | 2.1279 |

Current test subset metrics:

| Metric | Score |
| --- | ---: |
| BLEU-4 | 0.0607 |
| METEOR | 0.2559 |
| BERTScore F1 | 0.8586 |

Interpretation:

- Training is successful and stable.
- Dev loss improves consistently, then nearly plateaus after epoch 10.
- The model is usable as a baseline, but BLEU and METEOR show that generated recipes still differ substantially from references.
- Quality should be improved through better training setup and decoding, not just more epochs.

## Training Goals

The next model should improve:

- Ingredient coverage: generated steps should use the selected/main ingredients.
- Coherence: steps should form a plausible cooking process.
- Repetition control: repeated phrases and repeated steps should be reduced.
- Completeness: output should usually contain 3-6 useful steps.
- Evaluation reliability: all metrics should be computed from a loaded checkpoint, not from an uncertain notebook memory state.

## Stage 1: Make The Current Transformer Training Reproducible

Priority: high

Before changing the architecture, make the current baseline easy to reproduce.

Required notebook/script changes:

1. Add a `load_checkpoint()` function.
2. After training, reload `best_spicy1_transformer_copy.pt` before evaluation.
3. Save `train_losses` and `dev_losses` to a JSON or CSV log.
4. Save generation examples from dev and test sets.
5. Export metrics to a file such as `training_runs/transformer_copy_baseline_metrics.json`.

Expected outcome:

- One clean baseline run with checkpoint, metrics, and examples.
- This becomes the comparison point for all later experiments.

## Stage 2: Train An Improved Transformer-Copy Model

Priority: high

Run this after Stage 1.

Suggested changes:

| Area | Baseline | Improved Run |
| --- | --- | --- |
| Epochs | 12 | 16-20 with early stopping |
| Early stopping | none | patience 3 |
| Label smoothing | none | 0.05 |
| Dropout | 0.15 | test 0.10 and 0.20 |
| Batch size | 32 | 32, or 64 if memory allows |
| LR | 3e-4 | keep 3e-4 first |
| Eval | subset test | full test plus fixed 100-sample qualitative set |

Recommended next run:

```text
Model: transformer_copy_v2
Epochs: 20
Early stopping patience: 3
Dropout: 0.15
Learning rate: 3e-4
Label smoothing: 0.05
Checkpoint: best_transformer_copy_v2.pt
```

Success criteria:

- Dev loss below 2.10, or similar dev loss with better generation quality.
- BLEU-4 above 0.07.
- METEOR above 0.28.
- Repetition rate visibly lower in sample outputs.

## Stage 3: Improve Decoding Before Judging The Model

Priority: high

The current sampling-based `generate_recipe()` can make the model look worse than it is.

Add a second generation method:

```text
generate_recipe_beam_search(...)
```

Recommended decoding settings:

| Parameter | Suggested Value |
| --- | --- |
| beam size | 4 |
| min length | 20 tokens |
| max length | 120-160 tokens |
| length penalty | 0.7-1.0 |
| repetition penalty | 1.1-1.3 |
| no repeat ngram | 3 |

Keep stochastic sampling for variety, but use beam search for evaluation.

## Stage 4: Train A Pretrained Text-To-Text Model For Quality Ceiling

Priority: medium-high

If the goal is a high-quality recipe generator, fine-tuning a pretrained model is the strongest path.

Recommended first model:

```text
google/flan-t5-small
```

Why:

- It is much more language-aware than a Transformer trained from scratch.
- It is small enough for local experimentation.
- It matches the task format: ingredients in, recipe text out.

Training format:

```text
Input:
Generate a recipe using these ingredients: chicken breast, rice, onion, garlic, soy sauce.

Target:
1. Cook the rice according to package directions.
2. Saute onion and garlic until fragrant.
3. Add chicken and cook until browned.
4. Stir in soy sauce and combine with rice.
5. Serve warm.
```

Recommended first fine-tune settings:

| Parameter | Value |
| --- | --- |
| Model | `google/flan-t5-small` |
| Max input length | 96 |
| Max target length | 192 |
| Epochs | 3 |
| Batch size | 8-16 |
| Learning rate | 3e-4 |
| Eval strategy | every epoch |
| Save best model | yes |

Success criteria:

- More fluent outputs than Transformer-copy.
- Lower repetition.
- Better human rating on 50 fixed ingredient prompts.

## Evaluation Protocol

Use the same evaluation set for every model.

Automatic metrics:

- BLEU-4
- METEOR
- BERTScore F1
- Ingredient coverage
- Repetition rate
- Average generated length
- Invalid/empty output rate

Human evaluation:

Score 50 fixed prompts from 1 to 5:

| Score | Meaning |
| --- | --- |
| 1 | unusable |
| 2 | partially relevant but poor |
| 3 | acceptable |
| 4 | good |
| 5 | high quality |

Recommended human criteria:

- Uses selected ingredients
- Cooking steps are logical
- Output is specific, not generic
- No obvious repetition
- Could a user actually follow this recipe?

## Recommended Immediate Next Step

Do Stage 1 first:

1. Update the current notebook so evaluation always reloads `best_spicy1_transformer_copy.pt`.
2. Add reproducible metric export.
3. Add a fixed evaluation prompt list.
4. Run the current baseline once.

Then do Stage 2:

1. Train `transformer_copy_v2`.
2. Compare it against the current checkpoint.

Only after the Transformer-copy model is cleanly evaluated should we start FLAN-T5 fine-tuning.
