const Express = require('express');
const cors = require('cors');
require('dotenv').config();
const paginate = require('mongoose-paginate-v2');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const app = Express();
app.use(cors());
app.use(Express.json());

// MongoDB
const productSchema = new mongoose.Schema({
    foodName: { type: String, required: true },
    foodImage: { type: String, required: true },
    foodCategory: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
    sold: { type: Number, required: true },
    creator: {
        email: { type: String, required: true },
        name: { type: String, required: true }
    },
    origin: { type: String, required: true },
    description: { type: String, required: true },
});
productSchema.plugin(paginate);
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    profile: { type: String },
    password: { type: String, required: true },
});
userSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.password
    return obj
}
const cartSchema = new mongoose.Schema({
    user: { type: String },
    product: { type: Object },
    quantity: { type: Number }
})
const userModel = mongoose.model('user', userSchema);
const productModel = mongoose.model('product', productSchema);
const cartModel = mongoose.model('cart', cartSchema);
// middleware
const middleWare = async (req, res, next) => {
    try {
        const token = req.headers.cookie.split('=')[1];
        const isValid = jwt.verify(token, process.env.SALT);
        const user = await userModel.findById(isValid.user_id)
        req.user = user;
        if (user) return next();
        return res.status(401).send('Unathorized')

    } catch (error) {
        return res.status(401).send("Missing Credentials");
    }
}

//User section
app.post('/sign-up', async (req, res, next) => {
    const { email, password, profile, name } = await req.body;
    let result;
    try {
        let user = await userModel.findOne({ email: email })
        if (user) {
            return res.status(400).send("email address already Used");
        }
        const cryptPassword = await bcrypt.hash(password, 12);
        const createdUser = new userModel({
            email, password: cryptPassword, profile, name
        });
        result = await createdUser.save();
    } catch (error) {
        console.log(error);
        return res.status(400).send('Bad Request')
    }
    res.status(201).send(result)
})
app.get('/user/me', middleWare, async (req, res) => {
    try {
        return res.status(200).send(req.user)
    } catch (error) {
        return res.status(400).send('email or password not matched')
    }
})
app.post('/login', async (req, res, next) => {
    const { email, password } = req.body;
    try {
        let user = await userModel.findOne({ email: email });
        if (user) {
            const decryptPass = await bcrypt.compare(password, user.password);
            const token = jwt.sign({ user_id: user._id, email }, process.env.SALT)
            if (decryptPass) {
                res.cookie('cafeu', token);
                return res.status(200).send(user)
            } else {
                res.status(401).send('email or passwoed not Found')
            }
        } else {
            return res.status(400).send('email or passwoed not Found')
        }
    } catch (error) {
        return res.status(400).send('email or password not matched')
    }
});
app.post('/google-auth', async (req, res) => {
    const { email, name, profile, _id } = req.body;
    console.log("body hre",req.body)
    try {
        const createdUser = new userModel({
            email, password: 'googleLogin', profile, name
        });
        result = await createdUser.save();
        const token = jwt.sign({ user_id: _id, email: email }, process.env.SALT)
        res.cookie('cafeu', token);
        return res.status(200).send({ email, name, profile, _id})

    }
    catch (error) {
        return res.status(400).send('email or password not matched')
    }
})
app.post('/logout', (req, res) => {
    try {

        res.clearCookie('cafeu');
        res.status(200).send("Logout Successfull");
    } catch (error) {
        res.status(400).send('Bad Request');
    }
})

app.get('/products', async (req, res, next) => {
    try {
        let query = {};
        let sortOptions = {};

        // Check if sortBy is provided in the query parameters
        if (req.query.sortBy) {
            const [field, order] = req.query.sortBy.split('|');
            console.log(field, order);
            sortOptions[field] = order === 'asc' ? 1 : -1;
        }

        // Use the constructed query and sort options in the productModel.find method
        const result = await productModel.find(query).sort(sortOptions).limit(req.query.limit || 6);

        return res.send(result);
    } catch (error) {
        console.log(error);
        return res.status(400).send("Bad Request");
    }
});

app.get('/products/me', middleWare, async (req, res, next) => {
    const user = req.user;
    let result;
    try {
        result = await productModel.find({ "creator.name": user.name, "creator.email": user.email }).exec();
    } catch (error) {
        return res.status(400).send("bad Request");
    }
    res.send(result)
});
app.get('/products/:id', middleWare, async (req, res) => {
    const id = req.params.id;
    try {
        const result = await productModel.findOne({ _id: id });
        res.status(200).send(result);
    } catch (error) {
        res.status(404).send('bad request');
    }
})
app.post('/products', async (req, res,) => {
    const { foodName, foodImage, foodCategory, price, quantity, creator, origin, description } = req.body;
    let result;
    try {
        const createdProduct = new productModel({
            foodName, foodImage, foodCategory, price, quantity, sold: 0, creator, origin, description
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
    const user = req.user;
    console.log(user);
    let result;
    try {
        result = await cartModel.find({ user: user.email }).exec();
    } catch (error) {
        return res.status(400).send('bad request');
    }
    res.status(201).send(result);
});

app.delete('/cart/:id', middleWare, async (req, res, next) => {
    const user = req.user;
    console.log(user);
    const id = req.params.id;
    let result;
    try {
        const rem = await cartModel.deleteOne({ _id: id });
        console.log(rem);
        result = await cartModel.find({ user: user.email }).exec();
        console.log(result);
    } catch (error) {
        return res.status(400).send('bad request');
    }
    res.status(201).send(result);
});

app.post('/cart', middleWare, async (req, res, next) => {
    const { user, product, quantity } = req.body;
    const createCart = new cartModel({
        user,
        product,
        quantity
    });
    let result;
    try {
        result = await createCart.save();
    } catch (error) {
        return res.status(400).send('bad request');
    }
    res.status(201).send(result)
})
app.get('/',  async (req, res, next) => {
    res.send("server is running").status(200);
});

mongoose.connect(process.env.DB_LINK)
app.listen(3000, () => {
    console.log('app listening to port 3000')
})
