const User = require("../models/user.model")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const cloudinary = require("../config/cloudinary")
const sendMail = require('../utils/sendMail')

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

        await sendMail({
            to: user.email,
            subject: 'Welcome to AgroSense 🌱',
            template: 'welcome.ejs',
            data: {
                name: user.fullName
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

        res.status(201).json({
            message: "Admin account created successfully",
            admin: {
                id: admin._id,
                fullName: admin.fullName,
                email: admin.email,
                role: admin.role,
                avatarUrl: admin.avatarUrl,
            }
        })

        // ── fetch the super admin who made this request ──
        const superAdmin = await User.findById(req.user._id)

        const createdAt = new Date().toLocaleString("en-GB", {
            dateStyle: "full",
            timeStyle: "short",
            timeZone: "Africa/Lagos"
        })

        // Email to the new admin
        await sendMail({
            to: admin.email,
            subject: 'Your AgroSense Admin Account Has Been Created',
            template: 'admin-created.ejs',
            data: {
                name: admin.fullName,
                email: admin.email,
                createdBy: superAdmin.fullName
            }
        })

        // Email to the super admin as confirmation
        await sendMail({
            to: superAdmin.email,
            subject: 'Admin Account Created — AgroSense',
            template: 'admin-created-superadmin-notify.ejs',
            data: {
                superAdminName: superAdmin.fullName,
                newAdminName: admin.fullName,
                newAdminEmail: admin.email,
                createdAt
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

        await User.findByIdAndDelete(id)

        res.status(200).json({ message: "Farmer deleted successfully" })

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

        res.status(200).json({ message: "Admin deleted successfully" })

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

        await User.findByIdAndDelete(user._id)

        res.status(200).json({
            message: "Account deleted successfully"
        })

    } catch (error) {
        console.error("Delete self error:", error.message)
        res.status(500).json({
            message: "Server error deleting account"
        })
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

        res.status(200).json({
            message: `Farmer ${farmer.status === "active" ? "activated" : "deactivated"} successfully`,
            status: farmer.status
        })

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
                name: farmer.fullName,
                status: farmer.status,
                actionDate
            }
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

        res.status(200).json({
            message: `Admin ${admin.status === "active" ? "activated" : "deactivated"} successfully`,
            status: admin.status
        })

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
                name: admin.fullName,
                status: admin.status,
                actionDate
            }
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

        res.status(200).json({ message: "Password changed successfully" })

        const actionDate = new Date().toLocaleString("en-GB", {
            dateStyle: "full",
            timeStyle: "short",
            timeZone: "Africa/Lagos"
        })

        await sendMail({
            to: user.email,
            subject: "Your AgroSense Password Has Been Changed",
            template: "password-changed.ejs",
            data: {
                name: user.fullName,
                email: user.email,
                actionDate
            }
        })

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
module.exports = { register, login, createAdmin, getAllFarmers, getAllAdmins, deleteAdmin, deleteFarmer, deleteSelf, toggleFarmerStatus, toggleAdminStatus,uploadAvatar, changePassword, updateProfile }
