import { Schema, model } from "mongoose";
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const userSchema = new Schema({
    fullName: {
        type: 'String',
        required: [true,'Name if required'],
        minLength: [3,'Name must be at least 3 character'],
        maxLength: [20,'name should be less than 20 character'],
        lowercase: true,
        trim: true
    },
    email: {
        type: 'String',
        required: [true, 'Email is required'],
        lowercase: true,
        trim: true,
        unique: true
        // match: [], - regEx
    },
    password: {
        type: 'String',
        required: [true,'Password is required'],
        minLength: [6, 'Password Must be at least 6 character '],
        select: false
    },
    avatar:{
        public_id:{
            type: 'String'
        },
        secure_url:{
            type: 'String'
        }
    },
    role: {
        type: 'String',
        enum: ['USER','ADMIN'],
        default: 'USER'
    },
    forgotPasswordToken: String,
    forgotPasswordExpiry: Date
},{
    timestamps: true
});

//password encrypt
userSchema.pre('save', async function(next){
    if(!this.isModified('password')){
        return next();
    }
    this.password = await bcrypt.hash(this.password, 10);
})

userSchema.methods = {
    generateJWTToken: async function(){
        return await jwt.sign(
            { id: this._id, email: this.email, subscription : this.subscription, role: this.role},
            process.env.JWT_SECRET,
            {expiresIn: process.env.JWT_EXPIRY}
        )
    },
    comparePassword: async function(plainTextPassword){
        return await bcrypt.compare(plainTextPassword, this.password);
    }
}

const User = model('User',userSchema);

export default User;