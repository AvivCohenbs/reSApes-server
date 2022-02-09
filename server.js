import express from "express";
import { readFile } from "fs/promises";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const Ingredient = mongoose.model("Ingredient", {
  name: String,
  allergie: String,
});

const Unit = mongoose.model("Unit", {
  name: String,
});

const IngredientQuantity = mongoose.model("IngredientQuantity", {
  quantity: Number,
  unit: { type: mongoose.Schema.Types.ObjectId, ref: "Unit" },
  ingredient: { type: mongoose.Schema.Types.ObjectId, ref: "Ingredient" },
});

const Recipe = mongoose.model("Recipe", {
  title: String,
  time: Number,
  difficulty: String,
  description: String,
  image: String,
  instructions: Array,
  ingredients: [{ type: mongoose.Schema.Types.ObjectId, ref: "Ingredient" }],
  vegan: Boolean,
  vegetarian: Boolean,
  ingredientsQuantities: [
    { type: mongoose.Schema.Types.ObjectId, ref: "IngredientQuantity" },
  ],
});

const app = express();

app.use(express.json());

// app.use(express.static("client/build"));

app.get("/recipes", async (req, res) => {
  const {
    term,
    allergies,
    ingredients,
    vegan,
    vegetarian,
    ingredientsQuantities,
  } = req.query;

  let allergiesIds = new Set();
  let ingredientsIds = new Set();
  let allergiesPromises = [];
  let ingredientsPromises = [];

  try {
    if (allergies) {
      const allergiesNames = allergies.split(",");
      allergiesPromises = allergiesNames.map(async (allergie) => {
        const ingredientsFound = await Ingredient.find({ allergie });
        if (ingredientsFound.length) {
          ingredientsFound.forEach((ingr) => {
            allergiesIds.add(ingr._id);
          });
        }
      });
    }
    if (ingredients) {
      const ingredientsNames = ingredients.split(",");
      ingredientsPromises = ingredientsNames.map(async (name) => {
        const recipesFound = await Ingredient.find({ name });
        if (recipesFound.length) {
          recipesFound.forEach((ing) => {
            ingredientsIds.add(ing._id);
          });
        }
      });
    }
    await Promise.all([...allergiesPromises, ...ingredientsPromises]);
    allergiesIds = Array.from(allergiesIds);
    ingredientsIds = Array.from(ingredientsIds);

    const ingredientsFilter = {
      $nin: allergiesIds,
    };

    if (ingredientsIds.length) {
      ingredientsFilter["$in"] = ingredientsIds;
    }

    const filter = {
      ingredients: ingredientsFilter,
    };

    if (vegetarian) {
      filter.vegetarian = true;
    }

    if (vegan) {
      filter.vegan = true;
    }

    let recipes = await Recipe.find(filter).populate("ingredients");

    if (term) {
      recipes = recipes.filter((recipe) =>
        recipe.title.toLowerCase().includes(term.toLowerCase())
      );
    }

    function shuffleArray(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
    }

    shuffleArray(recipes);
    res.send(recipes);
  } catch (e) {
    throw e;
  }
});

app.get("/ingredients", async (req, res) => {
  try {
    res.send(await Ingredient.find());
  } catch (e) {
    throw e;
  }
});

app.get("/units", async (req, res) => {
  try {
    res.send(await Unit.find());
  } catch (e) {
    throw e;
  }
});

app.get("/ingredientsQuantities", async (req, res) => {
  try {
    res.send(await IngredientQuantity.find());
  } catch (e) {
    throw e;
  }
});

app.get("/recipes/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const recipe = await Recipe.findById(id).populate("ingredients");
    res.send(recipe);
  } catch (e) {
    throw e;
  }
});

app.post("/recipes", async (req, res) => {
  const {
    title,
    time,
    difficulty,
    description,
    image,
    instructions,
    ingredients,
    vegan,
    vegetarian,
    ingredientsQuantities,
  } = req.body;
  const recipe = new Recipe({
    title,
    time,
    difficulty,
    description,
    image,
    instructions,
    ingredients,
    vegan,
    vegetarian,
    ingredientsQuantities,
  });
  await recipe.save();
  res.send(recipe);
});

app.post("/ingredients", async (req, res) => {
  const { name, allergie } = req.body;
  const ingredient = new Ingredient({
    name,
    allergie,
  });
  await ingredient.save();
  res.send(ingredient);
});

app.post("/units", async (req, res) => {
  const { name } = req.body;
  const unit = new Unit({
    name,
  });
  await unit.save();
  res.send(unit);
});

app.post("/ingredientsQuantities", async (req, res) => {
  const { unit, quantity, ingredient } = req.body;
  const ingredientQuantity = new IngredientQuantity({
    unit,
    quantity,
    ingredient,
  });
  await unit.save();
  res.send(ingredientQuantity);
});

app.delete("/recipes/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const recipe = await Recipe.findByIdAndDelete(id);
    res.send({ msg: "Success" });
  } catch (e) {
    res.send({ msg: "Failed" });
  }
});

app.delete("/ingredients/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const ingredient = await Ingredient.findByIdAndDelete(id);
    res.send({ msg: "Success" });
  } catch (e) {
    res.send({ msg: "Failed" });
  }
});

app.delete("/units/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const unit = await Unit.findByIdAndDelete(id);
    res.send({ msg: "Success" });
  } catch (e) {
    res.send({ msg: "Failed" });
  }
});

app.delete("/ingredientsQuantities/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const ingredientQuantity = await IngredientQuantity.findByIdAndDelete(id);
    res.send({ msg: "Success" });
  } catch (e) {
    res.send({ msg: "Failed" });
  }
});

app.put("/recipes/:id", async (req, res) => {
  const { id } = req.params;
  const body = req.body;
  const recipe = await Recipe.findByIdAndUpdate(id, body, { new: true });
  res.send(recipe);
});

app.put("/ingredients/:id", async (req, res) => {
  const { id } = req.params;
  const body = req.body;
  const ingredient = await Ingredient.findByIdAndUpdate(id, body, {
    new: true,
  });
  res.send(ingredient);
});

app.put("/units/:id", async (req, res) => {
  const { id } = req.params;
  const body = req.body;
  const unit = await Unit.findByIdAndUpdate(id, body, { new: true });
  res.send(unit);
});

app.put("/ingredientsQuantities/:id", async (req, res) => {
  const { id } = req.params;
  const body = req.body;
  const ingredientQuantity = await IngredientQuantity.findByIdAndUpdate(
    id,
    body,
    { new: true }
  );
  res.send(ingredientQuantity);
});

app.get("/recipes/:id", async (req, res) => {
  const { id } = req.params;
  const recipe = await Recipe.findById(id);
  recipe.ingredients.map((ingredient) => {
    const ing = Ingredient.find((ingr) => ingr.id === ingredient);
  });
  res.send(recipe);
});

app.get("/initRecipes", async (req, res) => {
  await initRecipes();
  res.send("DONE!");
});

async function initRecipes() {
  await Recipe.deleteMany();
  const json = JSON.parse(
    await readFile(new URL("./info.json", import.meta.url))
  );

  const mappedRecipes = json.recipes.map((recipe) => ({
    ...recipe,
    id: null,
    ingredients: recipe.ingredients,
  }));
  await Recipe.insertMany(mappedRecipes);
}

async function initDB() {
  const ingredientsFromDb = await Ingredient.find();

  if (!ingredientsFromDb.length) {
    const json = JSON.parse(
      await readFile(new URL("./info.json", import.meta.url))
    );

    const mappedIngredients = json.ingredients.map((ingredient) => ({
      id: null,
      ...ingredient,
    }));
    await Ingredient.insertMany(mappedIngredients);
  }
}

const { DB_USER, DB_PASS, DB_HOST, DB_NAME } = process.env;

mongoose.connect(
  `mongodb+srv://${DB_USER}:${DB_PASS}@${DB_HOST}/${DB_NAME}?retryWrites=true&w=majority`,
  (err) => {
    if (err) {
      console.log(err ? `db error: ${err}` : "db connected");
    }
    app.listen(process.env.PORT || 9000);
    initDB();
  }
);
