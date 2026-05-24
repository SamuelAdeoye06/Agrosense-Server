const User = require("../models/user.model")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const cloudinary = require("../config/cloudinary")
const sendMail = require('../utils/sendMail')
const SavedDate = require('../models/savedDate.model')
const { generateOTP, verifyOTP } = require('../utils/otp')


// reusable token generator
const generateToken = (id, role) => {
    const expiry = (role === 'admin' || role === 'super_admin') ? '4h' : '7d'
    return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: expiry })
}

// ── Register ──
const register = async (req, res) => {
    try {
        const { fullName, email, password, farmLocation, cropProfiles } = req.body

        if (!fullName || !email || !password) {
            return res.status(400).json({ message: "All required fields must be filled" })
        }
        if (!farmLocation) {
            return res.status(400).json({ message: "Farm location is required" })
        }

        // updated password validation to match frontend
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_#])[A-Za-z\d@$!%*?&_#]{8,}$/
        if (!passwordRegex.test(password)) {
            return res.status(400).json({
                message: "Password must be at least 8 characters and include uppercase, lowercase, number and special character (@$!%*?&_#)"
            })
        }

        const existingUser = await User.findOne({ email })
        if (existingUser) {
            return res.status(400).json({ message: "Email already registered" })
        }

        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(password, salt)

        const user = await User.create({
            fullName,
            email,
            password: hashedPassword,
            farmLocation,
            cropProfiles: cropProfiles || [],
        })

        const token = generateToken(user._id, user.role)
        
        await sendMail({
            to: user.email,
            subject: 'Welcome to AgroSense 🌱',
            template: 'welcome.ejs',
            data: {
                name: user.fullName
            }
        })

        res.status(201).json({
            message: "Account created successfully",
            token,
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                farmLocation: user.farmLocation,
                role: user.role, 
                avatarUrl: user.avatarUrl,
                cropProfiles: user.cropProfiles, 
            }
        })

    } catch (error) {
        console.error("Register error:", error.message)
        res.status(500).json({ message: "Server error during registration" })
    }
}

// ── Create Admin (Super Admin only) ──
const createAdmin = async (req, res) => {
    try {
        const { fullName, email, password } = req.body

        if (!fullName || !email || !password) {
            return res.status(400).json({ message: "All fields are required" })
        }

        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_#])[A-Za-z\d@$!%*?&_#]{8,}$/
        if (!passwordRegex.test(password)) {
            return res.status(400).json({
                message: "Password must be at least 8 characters and include uppercase, lowercase, number and special character (@$!%*?&_#)"
            })
        }

        const existingUser = await User.findOne({ email })
        if (existingUser) {
            return res.status(400).json({ message: "Email already exists" })
        }

        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(password, salt)

        const admin = await User.create({
            fullName,
            email,
            password: hashedPassword,
            role: "admin"
        })

        const superAdmin = await User.findById(req.user._id)

        const createdAt = new Date().toLocaleString("en-GB", {
            dateStyle: "full",
            timeStyle: "short",
            timeZone: "Africa/Lagos"
        })

        await sendMail({
            to: admin.email,
            subject: 'Your AgroSense Admin Account Has Been Created',
            template: 'admin-created.ejs',
            data: {
                name:      admin.fullName,
                email:     admin.email,
                createdBy: superAdmin.fullName
            }
        }).catch(err => console.error('Admin created email failed:', err.message))

        await sendMail({
            to: superAdmin.email,
            subject: 'Admin Account Created — AgroSense',
            template: 'admin-created-superadmin-notify.ejs',
            data: {
                superAdminName: superAdmin.fullName,
                newAdminName:   admin.fullName,
                newAdminEmail:  admin.email,
                createdAt
            }
        }).catch(err => console.error('Super admin notify email failed:', err.message))

        res.status(201).json({
            message: "Admin account created successfully",
            admin: {
                id:       admin._id,
                fullName: admin.fullName,
                email:    admin.email,
                role:     admin.role,
                avatarUrl: admin.avatarUrl,
            }
        })

    } catch (error) {
        console.error("Create admin error:", error.message)
        res.status(500).json({ message: "Server error while creating admin" })
    }
}

// ── Login ──
const login = async (req, res) => {
    try {
        const { email, password } = req.body

        // basic validation
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" })
        }

        // find user and include password field (select: false in model)
        const user = await User.findOne({ email }).select("+password")
        if (!user) {
            return res.status(401).json({ message: "Invalid email or password" })
        }

        // check if account is active
        if (user.status === "inactive") {
            return res.status(403).json({ message: "Your account has been deactivated. Contact support." })
        }

        // compare password
        const isMatch = await bcrypt.compare(password, user.password)
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid email or password" })
        }

        // generate token
        const token = generateToken(user._id, user.role)

        res.status(200).json({
            message: "Login successful",
            token,
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                farmLocation: user.farmLocation,
                role: user.role, 
                avatarUrl: user.avatarUrl,
                cropProfiles: user.cropProfiles, 
            }
        })

    } catch (error) {
        console.error("Login error:", error.message)
        res.status(500).json({ message: "Server error during login" })
    }
}

// Fetch Farmers
const getAllFarmers = async (req, res) => {
  try {
    const farmers = await User.find({ role: "farmer" })
      .select("-password")
      .sort({ createdAt: -1 })

    res.status(200).json({
      message: "Farmers retrieved successfully",
      count: farmers.length,
      farmers,
    })
  } catch (error) {
    console.error("Get all farmers error:", error.message)
    res.status(500).json({ message: "Server error fetching farmers" })
  }
}

const getAllAdmins = async (req, res) => {
  try {
    const admins = await User.find({ role: { $in: ['admin', 'super_admin'] } })
      .select('-password')
      .sort({ createdAt: 1 })

    res.status(200).json({
      message: 'Admins retrieved successfully',
      count: admins.length,
      admins,
    })
  } catch (error) {
    console.error('Get all admins error:', error.message)
    res.status(500).json({ message: 'Server error fetching admins' })
  }
}

const deleteFarmer = async (req, res) => {
    try {
        const { id } = req.params
        const currentUser = req.user

        const farmer = await User.findById(id)

        if (!farmer) {
            return res.status(404).json({ message: "Farmer not found" })
        }

        if (farmer.role !== "farmer") {
            return res.status(400).json({ message: "This account is not a farmer account" })
        }

        if (
            currentUser.role === "farmer" &&
            currentUser._id.toString() !== farmer._id.toString()
        ) {
            return res.status(403).json({ message: "You can only delete your own account" })
        }

        const actionDate = new Date().toLocaleString("en-GB", {
            dateStyle: "full",
            timeStyle: "short",
            timeZone: "Africa/Lagos"
        })

        // ── capture details before deletion ──
        const farmerName  = farmer.fullName
        const farmerEmail = farmer.email
        const isAdminDelete = currentUser.role !== "farmer"

        // ── delete saved dates first ──
        await SavedDate.deleteMany({ farmerId: farmer._id })
        await User.findByIdAndDelete(id)

        // ── only email if an admin deleted them, not self-delete ──
        if (isAdminDelete) {
            await sendMail({
                to: farmerEmail,
                subject: "Your AgroSense Account Has Been Removed",
                template: "farmer-deleted.ejs",
                data: {
                    name: farmerName,
                    email: farmerEmail,
                    actionDate
                }
            })
        }

        res.status(200).json({ message: "Farmer deleted successfully" })

    } catch (error) {
        console.error("Delete farmer error:", error.message)
        res.status(500).json({ message: "Server error deleting farmer" })
    }
}


// ── Delete Admin (Super Admin only) ──
const deleteAdmin = async (req, res) => {
    try {
        const { id } = req.params

        const admin = await User.findById(id)

        if (!admin) {
            return res.status(404).json({ message: "Admin not found" })
        }

        if (admin.role === "super_admin") {
            return res.status(403).json({ message: "Super Admin account cannot be deleted" })
        }

        if (admin.role !== "admin") {
            return res.status(400).json({ message: "This account is not an admin" })
        }

        if (req.user._id.toString() === admin._id.toString()) {
            return res.status(400).json({ message: "You cannot delete your own admin account" })
        }

        const actionDate = new Date().toLocaleString("en-GB", {
            dateStyle: "full",
            timeStyle: "short",
            timeZone: "Africa/Lagos"
        })

        // ── capture before deletion ──
        const adminName  = admin.fullName
        const adminEmail = admin.email

        await User.findByIdAndDelete(id)

        await sendMail({
            to: adminEmail,
            subject: "Your AgroSense Admin Account Has Been Removed",
            template: "admin-deleted.ejs",
            data: {
                name: adminName,
                email: adminEmail,
                actionDate
            }
        })

        res.status(200).json({ message: "Admin deleted successfully" })


    } catch (error) {
        console.error("Delete admin error:", error.message)
        res.status(500).json({ message: "Server error deleting admin" })
    }
}

// ── Delete Self (User deletes own account) ──
const deleteSelf = async (req, res) => {
    try {
        const user = req.user

        if (user.role !== "farmer") {
            return res.status(403).json({
                message: "Only farmers can delete their own accounts. Admins must be deleted by a Super Admin."
            })
        }

        // ── delete saved dates first ──
        await SavedDate.deleteMany({ farmerId: user._id })
        await User.findByIdAndDelete(user._id)

        res.status(200).json({ message: "Account deleted successfully" })

    } catch (error) {
        console.error("Delete self error:", error.message)
        res.status(500).json({ message: "Server error deleting account" })
    }
}

const toggleFarmerStatus = async (req, res) => {
    try {
        const { id } = req.params

        const farmer = await User.findById(id)

        if (!farmer) {
            return res.status(404).json({ message: "Farmer not found" })
        }

        if (farmer.role !== "farmer") {
            return res.status(400).json({ message: "This account is not a farmer" })
        }

        farmer.status = farmer.status === "active" ? "inactive" : "active"
        await farmer.save()

        const actionDate = new Date().toLocaleString("en-GB", {
            dateStyle: "full",
            timeStyle: "short",
            timeZone: "Africa/Lagos"
        })

        await sendMail({
            to: farmer.email,
            subject: farmer.status === "active"
                ? "Your AgroSense Account Has Been Reactivated"
                : "Your AgroSense Account Has Been Deactivated",
            template: "farmer-status.ejs",
            data: {
                name:       farmer.fullName,
                status:     farmer.status,
                actionDate
            }
        }).catch(err => console.error('Farmer status email failed:', err.message))

        res.status(200).json({
            message: `Farmer ${farmer.status === "active" ? "activated" : "deactivated"} successfully`,
            status: farmer.status
        })

    } catch (error) {
        console.error("Toggle farmer status error:", error.message)
        res.status(500).json({ message: "Server error updating farmer status" })
    }
}

// toggle admin status
const toggleAdminStatus = async (req, res) => {
    try {
        const { id } = req.params

        const admin = await User.findById(id)

        if (!admin) {
            return res.status(404).json({ message: "Admin not found" })
        }

        if (admin.role === "super_admin") {
            return res.status(403).json({ message: "Super Admin status cannot be changed" })
        }

        if (admin.role !== "admin") {
            return res.status(400).json({ message: "This account is not an admin" })
        }

        admin.status = admin.status === "active" ? "inactive" : "active"
        await admin.save()

        const actionDate = new Date().toLocaleString("en-GB", {
            dateStyle: "full",
            timeStyle: "short",
            timeZone: "Africa/Lagos"
        })

        await sendMail({
            to: admin.email,
            subject: admin.status === "active"
                ? "Your AgroSense Admin Account Has Been Reactivated"
                : "Your AgroSense Admin Account Has Been Deactivated",
            template: "admin-status.ejs",
            data: {
                name:       admin.fullName,
                status:     admin.status,
                actionDate
            }
        }).catch(err => console.error('Admin status email failed:', err.message))

        res.status(200).json({
            message: `Admin ${admin.status === "active" ? "activated" : "deactivated"} successfully`,
            status: admin.status
        })

    } catch (error) {
        console.error("Toggle admin status error:", error.message)
        res.status(500).json({ message: "Server error updating admin status" })
    }
}

// ── Upload Avatar ──
const uploadAvatar = async (req, res) => {
    try {
        const { profileImage } = req.body

        if (!profileImage) {
            return res.status(400).json({ message: "No image provided" })
        }

        // guard — ensure it's actually a base64 data URI
        if (!profileImage.startsWith('data:image/')) {
            return res.status(400).json({ message: "Invalid image format. Please upload a valid image." })
        }

        const userId = req.user._id

        const currentUser = await User.findById(userId)
        if (currentUser.avatarPublicId) {
            try {
                await cloudinary.uploader.destroy(currentUser.avatarPublicId)
            } catch (delErr) {
                console.error("Failed to delete old avatar:", delErr?.message || delErr)
            }
        }

        const result = await cloudinary.uploader.upload(profileImage, {
            folder: "agrosense/avatars",
            timeout: 60000,
            transformation: [
                { width: 400, height: 400, crop: "fill", gravity: "face" },
                { quality: "auto" }
            ]
        })

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
                avatarUrl:      result.secure_url,
                avatarPublicId: result.public_id
            },
            { new: true }
        )

        res.status(200).json({
            message: "Profile picture updated successfully",
            user: {
                id:             updatedUser._id,
                fullName:       updatedUser.fullName,
                email:          updatedUser.email,
                farmLocation:   updatedUser.farmLocation,
                role:           updatedUser.role,
                avatarUrl:      updatedUser.avatarUrl,
                avatarPublicId: updatedUser.avatarPublicId,
                cropProfiles:   updatedUser.cropProfiles,
            }
        })

    } catch (error) {
        // Cloudinary sometimes throws a plain object, not an Error instance
        const errMsg = error?.message || error?.error?.message || JSON.stringify(error)
        console.error("Upload avatar error (full):", errMsg)
        res.status(500).json({ message: "Server error uploading avatar" })
    }
}

// ── Change Password ──
const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: "Both current and new password are required" })
        }

        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_#])[A-Za-z\d@$!%*?&_#]{8,}$/
        if (!passwordRegex.test(newPassword)) {
            return res.status(400).json({
                message: "New password must be at least 8 characters and include uppercase, lowercase, number and special character"
            })
        }

        const user = await User.findById(req.user._id).select("+password")

        const isMatch = await bcrypt.compare(currentPassword, user.password)
        if (!isMatch) {
            return res.status(401).json({ message: "Current password is incorrect" })
        }

        const salt = await bcrypt.genSalt(10)
        user.password = await bcrypt.hash(newPassword, salt)
        await user.save()

        const actionDate = new Date().toLocaleString("en-GB", {
            dateStyle: "full",
            timeStyle: "short",
            timeZone: "Africa/Lagos"
        })

        await sendMail({
            to:       user.email,
            subject:  "Your AgroSense Password Has Been Changed",
            template: "password-changed.ejs",
            data: {
                name:       user.fullName,
                email:      user.email,
                actionDate
            }
        }).catch(err => console.error('Password changed email failed:', err.message))

        res.status(200).json({ message: "Password changed successfully" })

    } catch (error) {
        console.error("Change password error:", error.message)
        res.status(500).json({ message: "Server error changing password" })
    }
}

// Update profile
const updateProfile = async (req, res) => {
    try {
        const { cropProfiles, farmLocation, fullName } = req.body
        const updateData = {}
        if (cropProfiles !== undefined) updateData.cropProfiles = cropProfiles
        if (farmLocation  !== undefined) updateData.farmLocation  = farmLocation
        if (fullName      !== undefined) updateData.fullName      = fullName  // ✅

        const updated = await User.findByIdAndUpdate(
            req.user._id,
            updateData,
            { new: true }
        )
        res.status(200).json({ 
            message: "Profile updated",
            user: {
                id:           updated._id,
                fullName:     updated.fullName,
                email:        updated.email,
                farmLocation: updated.farmLocation,
                role:         updated.role,
                avatarUrl:    updated.avatarUrl,
                cropProfiles: updated.cropProfiles,
            }
        })
    } catch (error) {
        res.status(500).json({ message: "Failed to update profile" })
    }
}
// ── Send OTP (for delete account confirmation) ──
const sendOTP = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
        const { plain, hashed } = await generateOTP()

        user.otp       = hashed
        user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000) // 10 mins
        user.otpAttempts  = 0 
        await user.save()

        await sendMail({
            to:       user.email,
            subject:  'Your AgroSense Account Deletion OTP',
            template: 'otp.ejs',
            data: {
                name:    user.fullName,
                otp:     plain,
                purpose: 'delete'
            }
        })

        res.status(200).json({ message: 'OTP sent to your email' })

    } catch (error) {
        console.error('Send OTP error:', error.message)
        res.status(500).json({ message: 'Server error sending OTP' })
    }
}

// ── Verify OTP + Delete Account ──
const verifyOTPAndDelete = async (req, res) => {
    try {
        const { otp } = req.body

        const user = await User.findById(req.user._id)
            .select('+otp +otpExpiry +otpAttempts')

        if (!user.otp || !user.otpExpiry) {
            return res.status(400).json({
                message: 'No OTP found. Please request a new one.'
            })
        }

        // ── OTP expired ──
        if (new Date() > user.otpExpiry) {
            user.otp = null
            user.otpExpiry = null
            user.otpAttempts = 0

            await user.save()

            return res.status(400).json({
                message: 'OTP has expired. Please request a new one.'
            })
        }

        // ── Too many attempts ──
        if (user.otpAttempts >= 5) {
            user.otp = null
            user.otpExpiry = null
            user.otpAttempts = 0

            await user.save()

            return res.status(400).json({
                message: 'Too many failed attempts. Please request a new OTP.'
            })
        }

        const isValid = await verifyOTP(
            String(otp),
            String(user.otp)
        )

        // ── Invalid OTP ──
        if (!isValid) {
            user.otpAttempts += 1

            await user.save()

            const remaining = 5 - user.otpAttempts

            return res.status(400).json({
                message:
                    remaining > 0
                        ? `Invalid OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
                        : 'Too many failed attempts. Please request a new OTP.'
            })
        }

        // ── OTP valid ──
        user.otpAttempts = 0
        user.otp = null
        user.otpExpiry = null

        await user.save()

        await SavedDate.deleteMany({
            farmerId: user._id
        })

        await User.findByIdAndDelete(user._id)

        res.status(200).json({
            message: 'Account deleted successfully'
        })

    } catch (error) {
        console.error(
            'Verify OTP delete error:',
            error.message
        )

        res.status(500).json({
            message: 'Server error verifying OTP'
        })
    }
}

// ── Forgot Password — Step 1: send OTP ──
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body
        const user      = await User.findOne({ email })

        // always return 200 so we don't reveal if email exists
        if (!user) {
            return res.status(200).json({ message: 'If that email exists, an OTP has been sent.' })
        }

        const { plain, hashed } = await generateOTP()
        user.otp       = hashed
        user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000)
        user.otpAttempts  = 0 
        await user.save()

        await sendMail({
            to:       user.email,
            subject:  'Reset Your AgroSense Password',
            template: 'otp.ejs',
            data: {
                name:    user.fullName,
                otp:     plain,
                purpose: 'reset'
            }
        })

        res.status(200).json({ message: 'If that email exists, an OTP has been sent.' })

    } catch (error) {
        console.error('Forgot password error:', error.message)
        res.status(500).json({ message: 'Server error' })
    }
}

// ── Forgot Password — Step 2: verify OTP ──
const verifyForgotPasswordOTP = async (req, res) => {
    try {
        const { email, otp } = req.body

        const user = await User.findOne({ email })
            .select('+otp +otpExpiry +otpAttempts')

        if (!user || !user.otp || !user.otpExpiry) {
            return res.status(400).json({
                message: 'Invalid or expired OTP.'
            })
        }

        // ── OTP expired ──
        if (new Date() > user.otpExpiry) {
            user.otp = null
            user.otpExpiry = null
            user.otpAttempts = 0

            await user.save()

            return res.status(400).json({
                message: 'OTP has expired. Please request a new one.'
            })
        }

        // ── Too many attempts ──
        if (user.otpAttempts >= 5) {
            user.otp = null
            user.otpExpiry = null
            user.otpAttempts = 0

            await user.save()

            return res.status(400).json({
                message: 'Too many failed attempts. Please request a new OTP.'
            })
        }

        const isValid = await verifyOTP(
            String(otp),
            String(user.otp)
        )

        // ── Invalid OTP ──
        if (!isValid) {
            user.otpAttempts += 1

            await user.save()

            const remaining = 5 - user.otpAttempts

            return res.status(400).json({
                message:
                    remaining > 0
                        ? `Invalid OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
                        : 'Too many failed attempts. Please request a new OTP.'
            })
        }

        // ── OTP valid ──
        user.otpAttempts = 0
        user.otp = null
        user.otpExpiry = null

        await user.save()

        res.status(200).json({
            message: 'OTP verified',
            email
        })

    } catch (error) {
        console.error(
            'Verify forgot password OTP error:',
            error.message
        )

        res.status(500).json({
            message: 'Server error'
        })
    }
}

// ── Forgot Password — Step 3: set new password ──
const resetPassword = async (req, res) => {
    try {
        const { email, newPassword } = req.body

        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_#])[A-Za-z\d@$!%*?&_#]{8,}$/
        if (!passwordRegex.test(newPassword)) {
            return res.status(400).json({
                message: 'Password must be at least 8 characters with uppercase, lowercase, number and special character'
            })
        }

        const user = await User.findOne({ email })
        if (!user) {
            return res.status(404).json({ message: 'User not found' })
        }

        const salt    = await bcrypt.genSalt(10)
        user.password = await bcrypt.hash(newPassword, salt)
        await user.save()

        const actionDate = new Date().toLocaleString("en-GB", {
            dateStyle: "full",
            timeStyle: "short",
            timeZone: "Africa/Lagos"
        })

        await sendMail({
            to:       user.email,
            subject:  'Your AgroSense Password Has Been Reset',
            template: 'password-changed.ejs',
            data: {
                name:       user.fullName,
                email:      user.email,
                actionDate
            }
        }).catch(err => console.error('Reset password email failed:', err.message))

        res.status(200).json({ message: 'Password reset successfully' })

    } catch (error) {
        console.error('Reset password error:', error.message)
        res.status(500).json({ message: 'Server error' })
    }
}

module.exports = { register, login, createAdmin, getAllFarmers, getAllAdmins, deleteAdmin, deleteFarmer, deleteSelf, toggleFarmerStatus, toggleAdminStatus,uploadAvatar, changePassword, updateProfile, sendOTP, verifyOTPAndDelete, forgotPassword, verifyForgotPasswordOTP, resetPassword }
