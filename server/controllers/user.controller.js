import User from "../models/user.model.js";
import AppError from "../utils/error.util.js";
import cloudinary from 'cloudinary';
import fs from 'fs/promises';
import sendEmail from "../utils/sendEmail.js";
import crypto from 'crypto';

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
            secure_url : 'https://res.cloudinary.com/du9jzqlpt/image/upload/v1674647316/avatar_'
        }
    });

    if(!user){
        return next(new AppError('User registration failed, please try again', 400));
    }

    //todo: file upload

    if(req.file){
        try{
            const result = await cloudinary.v2.uploader.upload(req.file.path, {
                folder: 'lms',
                width: 250,
                height: 250,
                gravity: 'faces',
                crop: 'fill'
            });

            if(result){
                user.avatar.public_id = result.public_id;
                user.avatar.secure_url = result.secure_url;

                //remove file from server
                fs.rm(`uploads/${req.file.filename}`)
            }
        }catch(e){
            return next(
                new AppError(error || 'File not uploaded, please try agin', 500)
            )
        }
    }

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

const login = async (req,res,next) =>{
    
    try {
        const {email,password} = req.body;

        //return response with an error message if the email of password is missing
        if (!email || !password){
            return next(new AppError('All fields required', 400));
        }

        const user = await userModel.findOne({
            email
        })
        .select('+password');
    
        if(!user || !user.comparePassword(password)){
            return next(new AppError('Email or password does not match', 400));
        }
    
        //create the JWT token using the userSchema method (jwtToken())
        const token = await user.generateJWTToken();
        user.password = undefined;
    
        const cookieOption = {
            maxAge : 24*60 * 60 *1000,
            httpOnly: true
        };
    
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

const logout = (req,res,next) =>{
    try {
        res.cookie('token',null,{
            secure: true,
            maxAge: 0,
            httpOnly: true
        });
        res.status(200).json({
            success: true,
            message: "User logged Out successfully"
        })
    } catch (e) {
        return next(new AppError(e.message, 500));
        
    }

};

const getProfile = async (req,res,next) =>{
    
    try {
        const userId = req.user.id;
        const user = await userModel.findById(userId);
        return res.status(200).json({
            success : true,
            data : user
        });
    } catch (e) {
        return next(new AppError('Failed to fetch profile detail', 500));
    }
};

const forgotPassword = async (req, res, next) => {
    const { email } = req.body;
    
    if(!email){
        return next(new AppError('Email is required', 400))
    }

    const user = await User.findOne({email});
    if(!user){
        return next(new AppError('User not found', 400))
    }

    const resetToken = await user.generatePasswordResetToken();

    await user.save();

    const resetPasswordUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    const message = `You can reset your password by clicking <a href=${resetPasswordUrl} target="_blank">Reset your password</a>\nIf the above link does not work for some reason then copy paste this link in new tab ${resetPasswordUrl}.\n If you have not requested this, kindly ignore.`;
    try {
        await sendEmail(email, subject, message);

        res.status(200).json({
            success: true,
            message: `Rest password token has been set to ${email} successfully`
        })
    } catch (e) {

        user.forgotPasswordExpiry = undefined;
        user.forgotPasswordToken = undefined;

        await user.save();
        return next(new AppError(e.message, 500));
    }
}

const resetPassword = async (req, res, next) => {
    const { resetToken } = req.params;

    const { password } = req.body;

    const forgotPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

    const user = await User.findOne({
        forgotPasswordToken,
        forgotPasswordExpiry: { $gt: Date.now() }
    });

    if(!user){
        return next(
            new AppError('Token is invalid or expired, please try angin! ', 400)
        )
    }

    user.password = password;
    user.forgotPasswordToken = undefined;
    user.forgotPasswordExpiry = undefined;

    user.save();

    res.status(200).json({
        success: true,
        message: "Password changed successfully"
    })
}

const changePassword = async(req, res) =>{
    const { oldPassword, newpassword } = req.body;
    const {id} = req.body;

    if(!oldPassword || !newpassword){
        return next(new AppError('All fields are mandatory', 400));
    }

    const user = await User.findById(id).select('+password');

    if(!user){
        return next(new AppError('user does not exist', 400));
    };

    const isPasswordvalid = await user.comparepassword(oldPassword);

    if(!isPasswordvalid){
        return next(new AppError('Invalid old password', 400));
    };

    await user.save();

    user.password = undefined;

    res.status(200).json({
        success: true,
        message: "Password changed successfully"
    })

};

const updateUser = async (req, res) => {
    const {fullName} = req.body
    const {id} = req.user.id;

    const user = await User.findById(id);

    if(!user){
        return next(new AppError('User does not exist', 400));
    };

    if(req.fullName){
        user.fullName = fullName;
    }

    if(req.file){
        await cloudinary.v2.uploader.destroy(user.avatar.public_id);

        try{
            const result = await cloudinary.v2.uploader.upload(req.file.path, {
                folder: 'lms',
                width: 250,
                height: 250,
                gravity: 'faces',
                crop: 'fill'
            });

            if(result){
                user.avatar.public_id = result.public_id;
                user.avatar.secure_url = result.secure_url;

                //remove file from server
                fs.rm(`uploads/${req.file.filename}`)
            }
        }catch(e){
            return next(
                new AppError(error || 'File not uploaded, please try agin', 500)
            )
        }
    }

    await user.save();

    res.status(200).json({
        succes: true,
        message: 'User profile successfully updated!'
    })

}

export{
    register,
    login,
    logout,
    getProfile,
    forgotPassword,
    resetPassword,
    changePassword,
    updateUser
}