import express from "express";
import path from "path";
import multer from "multer";
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

const Comment = mongoose.model("Comment", {
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  content: String,
});

const User = mongoose.model("User", {
  email: String,
  password: String,
  favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: "Recipe" }],
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
    {
      quantity: Number,
      unit: { type: mongoose.Schema.Types.ObjectId, ref: "Unit" },
      ingredient: { type: mongoose.Schema.Types.ObjectId, ref: "Ingredient" },
    },
  ],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  comments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Comment" }],
});

const app = express();

app.use(express.json());

app.use("/images", express.static("images"));

const imageStorage = multer.diskStorage({
  // Destination to store image
  destination: "images/",
  filename: (req, file, cb) => {
    console.log("filename", file);
    cb(
      null,
      file.fieldname + "_" + Date.now() + path.extname(file.originalname)
    );
    // file.fieldname is name of the field (image)
    // path.extname get the uploaded file extension
  },
});

const imageUpload = multer({
  storage: imageStorage,
  limits: {
    fileSize: 100000000, // 1000000 Bytes = 1 MB
  },
  fileFilter(req, file, cb) {
    console.log("file", file);
    if (!file.originalname.match(/\.(png|jpg)$/)) {
      // upload only png and jpg format
      return cb(new Error("Please upload a Image"));
    }
    cb(undefined, true);
  },
});

const auth = async (req, res, next) => {
  const { id } = req.headers;
  if (!id) {
    res.status(403).send();
  } else {
    try {
      const user = await User.findById(id);
      if (!user) {
        res.status(403).send();
      } else {
        next();
      }
    } catch (err) {
      res.status(403).send();
    }
  }
};

app.get("/recipes", async (req, res) => {
  const { term, allergies, ingredients, vegan, vegetarian } = req.query;
  console.log(req.headers);
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

    let recipes = await Recipe.find(filter)
      .populate("ingredients")
      .populate("ingredientsQuantities.unit")
      .populate("ingredientsQuantities.ingredient");

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

app.get("/recipes/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const recipe = await Recipe.findById(id)
      .populate("ingredients")
      .populate("ingredientsQuantities.unit")
      .populate("ingredientsQuantities.ingredient")
      .populate({
        path: "comments",
        populate: {
          select: "email",
          path: "user",
          model: "User",
        },
      });

    res.send(recipe);
  } catch (e) {
    throw e;
  }
});

app.post("/recipes", auth, imageUpload.single("image"), async (req, res) => {
  const {
    title,
    time,
    difficulty,
    description,
    // image,
    instructions,
    vegan,
    vegetarian,
    ingredientsQuantities = [],
    comments = [],
  } = req.body;

  const ingredients = [];

  const ingrQty = JSON.parse(ingredientsQuantities).map((ing) => {
    ingredients.push(ing.Ingredient._id);
    return {
      ingredient: ing.Ingredient._id,
      quantity: ing.Quantity,
      unit: ing.Unit._id,
    };
  });

  const recipe = new Recipe({
    title,
    time,
    difficulty,
    description,
    image: req.file.filename,
    instructions,
    ingredients,
    vegan,
    vegetarian,
    ingredientsQuantities: ingrQty,
    comments,
  });
  await recipe.save();

  res.send(recipe);
});

app.post("/recipes/:id/comment", auth, async (req, res) => {
  const { user, content } = req.body;

  const { id } = req.params;
  const comment = new Comment({ user, content });

  await comment.save();
  const recipe = await Recipe.findByIdAndUpdate(
    id,
    { $addToSet: { comments: comment._id } },
    { new: true }
  );

  await recipe.save();

  res.send(await comment.populate("user"));
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

app.get("/ingredients", async (req, res) => {
  try {
    res.send(await Ingredient.find());
  } catch (e) {
    throw e;
  }
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

app.delete("/ingredients/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const ingredient = await Ingredient.findByIdAndDelete(id);
    res.send({ msg: "Success" });
  } catch (e) {
    res.send({ msg: "Failed" });
  }
});

app.get("/units", async (req, res) => {
  try {
    res.send(await Unit.find());
  } catch (e) {
    throw e;
  }
});

app.post("/units", async (req, res) => {
  const { name } = req.body;
  const unit = new Unit({
    name,
  });
  await unit.save();
  res.send(unit);
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

app.get("/users", async (req, res) => {
  try {
    res.send(await User.find());
  } catch (e) {
    throw e;
  }
});

app.post("/users", async (req, res) => {
  const { email, password } = req.body;
  const user = new User({
    email,
    password,
  });
  await user.save();
  res.send(user);
});

app.delete("/users/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findByIdAndDelete(id);
    res.send({ msg: "Success" });
  } catch (e) {
    res.send({ msg: "Failed" });
  }
});

app.get("/comments", async (req, res) => {
  try {
    res.send(await Comment.find().populate("user"));
  } catch (e) {
    throw e;
  }
});

app.delete("/recipes/:id/comment/:commentId", async (req, res) => {
  const { id } = req.params;
  try {
    const comment = await Comment.findByIdAndDelete(id);
    res.send({ msg: "Success" });
  } catch (e) {
    res.send({ msg: "Failed" });
  }
});

app.put("/recipes/:id", async (req, res) => {
  const { id } = req.params;
  const { commentContent, userId } = req.body;
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

app.put("/users/:id", async (req, res) => {
  const { id } = req.params;
  const { favoriteId } = req.body;
  const user = await User.findByIdAndUpdate(id, body, { new: true });
  res.send(user);
});

app.put("/comments/:id", async (req, res) => {
  const { id } = req.params;
  const body = req.body;
  const comment = await Comment.findByIdAndUpdate(id, body, { new: true });
  res.send(comment);
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

app.post("/login", async (req, res) => {
  // YES -> res.send({"success": true}) -> on CLIENT: redirect to community, save on cookie ("")
  const { email, password } = req.body;
  const user = await User.findOne({ email, password });
  if (user) {
    res.send({ success: true, user });
  } else {
    res.send({ success: false, error: "please try again" });
  }
});

app.post(
  "/uploadImage",
  imageUpload.single("image"),
  (req, res) => {
    console.log("req.file", req.file);
    res.send(req.file);
  },
  (error, req, res, next) => {
    res.status(400).send({ error: error.message });
  }
);

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
