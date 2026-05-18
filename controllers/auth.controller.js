const User = require("../models/user.model")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const cloudinary = require("../config/cloudinary")

// reusable token generator
const generateToken = (id, role) => {
    return jwt.sign(
        { id, role },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
    )
}

// ── Register ──
const register = async (req, res) => {
    try {
        const { fullName, email, password, farmLocation } = req.body

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
                role: user.role, avatarUrl: user.avatarUrl,
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

        // regex validation for admin password too
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
                role: user.role, avatarUrl: user.avatarUrl,
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

// ── Delete Farmer/User ──
const deleteFarmer = async (req, res) => {
    try {
        const { id } = req.params

        // logged in user
        const currentUser = req.user

        // find target farmer
        const farmer = await User.findById(id)

        if (!farmer) {
            return res.status(404).json({
                message: "Farmer not found"
            })
        }

        // only farmer accounts can be deleted here
        if (farmer.role !== "farmer") {
            return res.status(400).json({
                message: "This account is not a farmer account"
            })
        }
        
        // if current user is farmer, ensure it's their own account
        if (
            currentUser.role === "farmer" &&
            currentUser._id.toString() !== farmer._id.toString()
        ) {
            return res.status(403).json({
                message: "You can only delete your own account"
            })
        }

        await User.findByIdAndDelete(id)

        res.status(200).json({
            message: "Farmer deleted successfully"
        })

    } catch (error) {
        console.error("Delete farmer error:", error.message)

        res.status(500).json({
            message: "Server error deleting farmer"
        })
    }
}


// ── Delete Admin (Super Admin only) ──
const deleteAdmin = async (req, res) => {
    try {
        const { id } = req.params

        const admin = await User.findById(id)

        if (!admin) {
            return res.status(404).json({
                message: "Admin not found"
            })
        }

        // prevent deleting super admin
        if (admin.role === "super_admin") {
            return res.status(403).json({
                message: "Super Admin account cannot be deleted"
            })
        }

        // ensure target is actually admin
        if (admin.role !== "admin") {
            return res.status(400).json({
                message: "This account is not an admin"
            })
        }

        // optional: prevent self delete
        if (req.user._id.toString() === admin._id.toString()) {
            return res.status(400).json({
                message: "You cannot delete your own admin account"
            })
        }

        await User.findByIdAndDelete(id)

        res.status(200).json({
            message: "Admin deleted successfully"
        })

    } catch (error) {
        console.error("Delete admin error:", error.message)

        res.status(500).json({
            message: "Server error deleting admin"
        })
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

// ── Toggle Farmer Status (Admin) ──
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

        // flip the status
        farmer.status = farmer.status === "active" ? "inactive" : "active"
        await farmer.save()

        res.status(200).json({
            message: `Farmer ${farmer.status === "active" ? "activated" : "deactivated"} successfully`,
            status: farmer.status
        })

    } catch (error) {
        console.error("Toggle farmer status error:", error.message)
        res.status(500).json({ message: "Server error updating farmer status" })
    }
}

// ── Toggle Admin Status (Super Admin only) ──
const toggleAdminStatus = async (req, res) => {
    try {
        const { id } = req.params

        const admin = await User.findById(id)

        if (!admin) {
            return res.status(404).json({ message: "Admin not found" })
        }

        // prevent modifying super admin
        if (admin.role === "super_admin") {
            return res.status(403).json({ message: "Super Admin status cannot be changed" })
        }

        if (admin.role !== "admin") {
            return res.status(400).json({ message: "This account is not an admin" })
        }

        // flip the status
        admin.status = admin.status === "active" ? "inactive" : "active"
        await admin.save()

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

        const userId = req.user._id

        // delete old avatar from cloudinary if it exists
        const currentUser = await User.findById(userId)
        if (currentUser.avatarPublicId) {
            try {
                await cloudinary.uploader.destroy(currentUser.avatarPublicId)
            } catch (delErr) {
                console.error("Failed to delete old avatar:", delErr.message)
                // continue with upload even if deletion fails
            }
        }

        // upload new image to cloudinary
        const result = await cloudinary.uploader.upload(profileImage, {
            folder: "agrosense/avatars",
            timeout: 60000, // 60 seconds
            transformation: [
                { width: 400, height: 400, crop: "fill", gravity: "face" },
                { quality: "auto" }
            ]
        })

        // save secure_url and public_id to user
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
                id:           updatedUser._id,
                fullName:     updatedUser.fullName,
                email:        updatedUser.email,
                farmLocation: updatedUser.farmLocation,
                role:         updatedUser.role,
                avatarUrl:    updatedUser.avatarUrl,
                avatarPublicId: updatedUser.avatarPublicId,
            }
        })

    } catch (error) {
        console.error("Upload avatar error:", error.message)
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

        // get user with password
        const user = await User.findById(req.user._id).select("+password")

        const isMatch = await bcrypt.compare(currentPassword, user.password)
        if (!isMatch) {
            return res.status(401).json({ message: "Current password is incorrect" })
        }

        const salt = await bcrypt.genSalt(10)
        user.password = await bcrypt.hash(newPassword, salt)
        await user.save()

        res.status(200).json({ message: "Password changed successfully" })

    } catch (error) {
        console.error("Change password error:", error.message)
        res.status(500).json({ message: "Server error changing password" })
    }
}

// Update crop profile
const updateCropProfile = async (req, res) => {
    try {
        const { cropProfiles } = req.body
        const updated = await User.findByIdAndUpdate(
            req.user._id,
            { cropProfiles },
            { new: true }
        )
        res.status(200).json({ message: "Profile updated", user: updated })
    } catch (error) {
        res.status(500).json({ message: "Failed to update profile" })
    }
}
module.exports = { register, login, createAdmin, getAllFarmers, getAllAdmins, deleteAdmin, deleteFarmer, deleteSelf, toggleFarmerStatus, toggleAdminStatus,uploadAvatar, changePassword, updateCropProfile }
