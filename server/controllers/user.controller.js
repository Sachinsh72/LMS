import User from "../models/user.model.js";
import AppError from "../utils/error.util.js";

const cookieOptions = {
    maxAge : 7*24*60*60*1000,
    httpOnly : true,
    secure: true
}

const register = async(req,res, next) =>{
    const {fullName, email, password } = req.body;

    if(!fullName || !email || !password){
        return next(new AppError('All fields are required', 400));
    }

    const userExits = await User.findOne({email});

    if(userExits){
        return next(new AppError('Email already exits', 400));
    }
    
    const user = await User.create({
        fullName,
        email,
        password,
        avatar: {
            publi_id: email,
            secure_url : 'https://res.cloudinary'
        }
    });

    if(!user){
        return next(new AppError('User registration failed, please try again', 400));
    }

    //todo: file upload

    await user.save();

    user.password = undefined;

    const token = await user.generateJWTToken();

    res.cookie('token',token, cookieOptions);

    res.status(201).json({
        succes: true,
        message : 'User registered successfully',
        user
    });

};

const login = async (req,res) =>{
    

    try {
        const {email,password} = req.body;

        //return response with an error message if the email of password is missing
        if (!email || !password){
            return next(new AppError('All fields required', 400));
        }

        const user = await userModel.findOne({
            email,password
        })
        .select('+password');
    
        if(!user || !user.comparePassword(password)){
            return next(new AppError('Email or password does not match', 400));
        }
    
        //create the JWT token using the userSchema method (jwtToken())
        const token = await user.generateJWTToken();
        user.password = undefined;
    
        // const cookieOption = {
        //     maxAge : 24*60 * 60 *1000,
        //     httpOnly: true
        // };
    
        //return a response with user object and cookie ( contains jwt Token)
        res.cookie("token",token, cookieOptions);
        res.status(200).json({
            success: true,
            message: 'User loggedIn successfully',
            data: user
        })
    } catch (e) {
        return next(new AppError(e.message, 500));
    }
};

// };

const logout = (req,res) =>{

};

const getProfile = (req,res) =>{

};

export{
    register,
    login,
    logout,
    getProfile
}