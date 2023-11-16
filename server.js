const Express = require('express');
const cors = require('cors');
require('dotenv').config();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const app = Express();
app.use(cors());
app.use(Express.json());

// middleware
const middleWare = async (req, res, next) => {
    try {
        const token = req.headers.authorization.split(" ")[1];
        const isValid = jwt.verify(token, process.env.SALT);
        if (isValid) return next();
        return res.status(401).send('Unathorized')

    } catch (error) {
        return res.status(401).send("Missing Credentials");
    }
}
// MongoDB
const productSchema = new mongoose.Schema({
    foodName: { type: String, required: true },
    foodImage: { type: String, required: true },
    foodCategory: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
    creator: { type: String, required: true },
    origin: { type: String, required: true },
    description: { type: String, required: true },
});
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    profile: { type: String },
    password: { type: String, required: true },
});
const cartSchema = new mongoose.Schema({
    user: mongoose.Types.ObjectId,
    products: { type: Array }
})
const userModel = mongoose.model('user', userSchema);
const productModel = mongoose.model('product', productSchema);


//User section
app.post('/sign-up', async (req, res, next) => {
    const { email, password, profile, name } = req.body;
    let result;
    try {
        let user = userModel.findOne({ email: email })
        if (user) {
            return res.status(409).send("email address already Used");
        }
        const cryptPassword = await bcrypt.hash(password, process.env.SALT, 12);
        const createdUser = new userModel({
            email, password: cryptPassword, profile, name
        });
        result = await createdUser.save();
    } catch (error) {
        console.log(error);
        return res.status(404).send('Bad Request')
    }
    res.status(201).send(result)
})

app.post('/login', async (req, res, next) => {
    const { email, password } = req.body;
    try {
        let user = await userModel.findOne({ email: email });
        if (user) {
            const decryptPass = await bcrypt.compare(password, user.password);
            console.log(decryptPass);
            const token = jwt.sign({ user_id: user._id, email }, process.env.SALT)
            return res.cookie("token", token).send(decryptPass);
        }
    } catch (error) {
        return res.status(404).send('email or password not matched')
    }
})
// Products section;
app.get('/products', async (req, res, next) => {
    console.log(req.headers)
    let result;
    try {
        result = await productModel.find();
    } catch (error) {
        return res.status(400).send("bad Request");
    }
    res.send(result)
});

app.post('/products', middleWare, async (req, res,) => {
    const { foodName, foodImage, foodCategory, price, quantity, creator, origin, description } = req.body;
    let result;

    try {
        const createdProduct = new productModel({
            foodName, foodImage, foodCategory, price, quantity, creator, origin, description
        })
        result = await createdProduct.save();
    } catch (error) {
        return res.status(400).send('Bad Request');
    }
    res.status(201).send(result);
});

app.patch('/products/:id', middleWare, async (req, res,) => {
    const id = req.params.id;
    const patchData = req.body;
    let result;
    try {
        result = await productModel.updateOne({ _id: id }, { $set: patchData });

        if (result.nModified === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.status(200).json({ message: 'Product updated successfully' });
    } catch (error) {
        return res.status(400).send('Bad Request');
    }
});

app.delete('/products/:id', middleWare, async (req, res) => {
    const productId = req.params.id;

    try {
        // Delete the product from the database
        const result = await productModel.deleteOne({ _id: productId });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.status(200).json({ message: 'Product deleted successfully' });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Cart Section
app.get('/cart', middleWare, async (req, res, next) => {
    const token = req.headers.cookie.split("=")[1];
    const userData = jwt.verify(token, process.env.SALT, (error, decoded) => {
        if (error) {
            return res.send('Bad Request');
        } else {
            console.log(decoded)
            return {
                userId: decoded.user_id,
                email: decoded.email
            }
        }
    })
    console.log(userData);
    res.send('cart api')
})

app.post('/cart', middleWare, async (req, res, next) => {
    res.send("server is running").status(200);
})
app.get('/', middleWare, async (req, res, next) => {
    res.send("server is running").status(200);
});

mongoose.connect(process.env.DB_LINK).then(() => {
    app.listen(3000, () => {
        console.log('app listening to port 3000')
    })
});