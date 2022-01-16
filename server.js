import express from "express";
import { readFile } from "fs/promises";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const Ingredient = mongoose.model("Ingredient", {
  name: String,
});

const Recipe = mongoose.model("Recipe", {
  title: String,
  time: Number,
  difficulty: String,
  description: String,
  image: String,
  instructions: Array,
  ingredients: [{ type: mongoose.Schema.Types.ObjectId, ref: "Ingredient" }],
});

const app = express();

app.use(express.json());

// app.use(express.static("client/build"));

app.get("/recipes", async (req, res) => {
  const { term } = req.query;
  try {
    const recipes = await Recipe.find().populate("ingredients");

    if (term) {
      recipes = recipes.filter((recipe) =>
        recipe.title.toLowerCase().includes(term.toLowerCase())
      );
    }
    console.log(recipes);
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
  const { title, ingredients } = req.body;
  const recipe = new Recipe({ title, ingredients });
  await recipe.save();
  res.send(recipe);
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

app.put("/recipes/:id", async (req, res) => {
  const { id } = req.params;
  const body = req.body;
  const recipe = await Recipe.findOneAndUpdate(id, body);
  res.send(recipe);
});

app.get("/recipes/:id", async (req, res) => {
  const { id } = req.params;
  const recipe = await Recipe.findById(id);
  recipe.ingredients.map((ingredient) => {
    const ing = Ingredient.find((ingr) => ingr.id === ingredient);
    console.log(ing);
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
