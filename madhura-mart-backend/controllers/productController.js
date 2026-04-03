const Product = require("../models/Product");

exports.createProduct = async (req, res) => {
  const product = new Product({
    name: req.body.name,
    price: req.body.price,
    description: req.body.description,
    image: req.body.image,
    category: req.body.category
  });

  await product.save();
  res.json(product);
};

exports.getProducts = async (req, res) => {
  const products = await Product.find().populate("category");
  res.json(products);
};
