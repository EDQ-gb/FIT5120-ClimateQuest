/**
 * Thin wrapper — recipe routing lives in recipe_generation_service.js.
 * Pollinations is not imported here.
 */

const recipeGeneration = require("./recipe_generation_service");

/** @deprecated Builtin PyTorch on Render is not used; kept for index.js wiring only. */
let recipeBuiltinRunner = null;

function setRecipeBuiltinRunner(fn) {
  recipeBuiltinRunner = typeof fn === "function" ? fn : null;
}

function resolveRecipeModelProvider() {
  return recipeGeneration.resolveRecipeProvider();
}

async function runRecipeModel(ingredients) {
  return recipeGeneration.generateRecipe(ingredients);
}

module.exports = {
  resolveRecipeModelProvider,
  setRecipeBuiltinRunner,
  runRecipeModel,
};
