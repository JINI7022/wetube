import User from "../models/User";
import fetch from "node-fetch";
import bcrypt from "bcrypt";

export const getJoin = (req, res) => {
    res.render("join", { pageTitle: "Create Account" });
};

export const postJoin = async (req, res) => {
    const { name, username, email, password,password2, location } = req.body;
    const exists = await User.exists({ $or: [{ username }, { email }] });

    if (password !== password2) {
        return res.status(400).render("join", {
            pageTitle: "join",
            errorMessage: "Password confirmation does not match",
        })
    }
    if (exists) {
        return res.status(400).render("join", {
            pageTitle: "Join",
            errorMessage: "This username/email is already taken."
        });
    }
    try {
        await User.create({
            name, username, email, password, location
        });
        return res.redirect("/login");
    } catch (error) {
        return res.status(400).render("join", {
            pageTitle: "Upload Video",
            errorMessage: error._message,
        })
    }

    
};

export const getLogin = (req, res) => res.render("login", { pageTitle: "Login" });

export const postLogin = async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username, socialOnly: false });
    if (!user) {
        return res.status(400).render("login",{
            pageTitle: "Login",
            errorMessage: "An account with this username does not exists"
        });
    }
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
        return res.status(400).render("login",{
            pageTitle: "Login",
            errorMessage: "Wrong password"
        });
    }
    req.session.loggedIn = true;
    req.session.user = user;
    return res.redirect("/");
    
};

export const startGithubLogin = (req, res) => {
    const baseUrl = "https://github.com/login/oauth/authorize?";
    const config = {
        client_id: process.env.GH_CLIENT,
        allow_signup: false,
        scope: "read:user user:email",
    }
    const params = new URLSearchParams(config).toString();
    const finalUrl = baseUrl + params;
    return res.redirect(finalUrl);
};

export const finishGithubLogin = async (req, res) => {
    const baseUrl = "https://github.com/login/oauth/access_token?";
    const config = {
        client_id: process.env.GH_CLIENT,
        client_secret: process.env.GH_SECRET,
        code: req.query.code,
    };
    const params = new URLSearchParams(config).toString();
    const finalUrl = baseUrl + params;
    const tokenRequest = await (await fetch(finalUrl, {
        method: "POST",
        headers: {
            Accept: "application/json",
        },
    })).json();
    if ("access_token" in tokenRequest) {
        const { access_token } = tokenRequest;
        const apiUrl = "https://api.github.com";
        const userData =
            await (await fetch(`${apiUrl}/user`, {
            headers: {
                Authorization: `token ${access_token}`,
            }
            })).json();
        
        const emailData = await (await fetch(`${apiUrl}/user/emails`, {
            headers: {
                Authorization: `token ${access_token}`,
            }
            })).json();
        const emailObj = emailData.find(
            (email) => email.primary === true && email.verified === true
        );
        if (!emailObj) {
            return res.redirect("/login");
        }
        let user = await User.findOne({ email: emailObj.email });
        if (!user) {
            user = await User.create({
                avatarUrl: userData.avatar_url,
                name: userData.login,
                username: userData.login,
                email: emailObj.email,
                socialOnly: true,
                password: "",
                location: userData.location,
            });
        }
        req.session.loggedIn = true;
        req.session.user = user;
        return res.redirect("/");
    } else {
        return res.redirect("/login");
    }
};

export const logout = (req, res) => {
    req.session.destroy();
    return res.redirect("/");
}; 


export const getEdit = (req, res) => {
    return res.render("edit-profile", { pageTitle: "Edit Profile" });
};
export const postEdit = async (req, res) => {
    const pageTitle = "Edit Profile";
    const {
        session: {
            user: { _id}
        },
        body: { name, email, username, location }       
    } = req;

    if (req.session.user.email != email) {
        const exist = User.exists({ email });
        if (exist) {
            return res.status(400).render("edit-profile", { pageTitle, errorMessage: "This email is already taken" });
        }
    } else if (req.session.user.username != username) {
        const exist = User.exists({ username });
        if (exist) {
            return res.status(400).render("edit-profile", { pageTitle, errorMessage: "This username is already taken" });
        }
    }

    const updatedUser = await User.findByIdAndUpdate(_id, {
        name, email, username, location
    }, { new: true });
    req.session.user = updatedUser;
    return res.redirect("/users/edit");
};

export const getChangePassword = (req, res) => { 
    if (req.session.user.socialOnly) return res.redirect("/users/edit");
    return res.render("users/change-password", { pageTitle: "Change Password" });
};
export const postChangePassword = async (req, res) => { 
    const {
        session: {
            user: {_id, password},
        },
        body: { oldPassword, newPassword, newPasswordConfirmation }
    } = req;

    const ok = await bcrypt.compare(oldPassword, password);

    if (!ok) {
        return res.status(400).render("users/change-password", {
            pageTitle: "Change Password",
            errorMessage: "The current password is not incorrect"
        });
    }

    if (newPassword !== newPasswordConfirmation) {
        return res.status(400).render("users/change-password", {
            pageTitle: "Change Password",
            errorMessage: "The password does not match the confirmation"
        });
    }

    const user = await User.findById(_id);
    user.password = newPassword;
    await user.save();
    req.session.user.password = user.password;
    return res.redirect("/");
};
export const see = (req, res) => res.send("See User"); 