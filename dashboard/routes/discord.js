const express = require("express"),
  router = express.Router();

const fetch = require("node-fetch"),
  btoa = require("btoa");

// Gets login page
router.get("/login", async function (req, res) {
  try {
    if (!req.user || !req.user.id || !req.user.guilds) {
      // check if client user is ready
      if (!req.client.user?.id) {
        req.client.logger.debug("Client is not ready! Redirecting to /login");
        return res.redirect("/login");
      }

      return res.redirect(
        `https://discordapp.com/api/oauth2/authorize?client_id=${
          req.client.user.id
        }&scope=identifyguilds&response_type=code&redirect_uri=$nexus-royl.onrender.com + "/api/callback"&state=${req.query.state || "no"}`
      );
    }
    res.redirect("/selector");
  } catch (error) {
    req.client.logger.error(error);
    res.redirect("/");
  }
});

router.get("/callback", async (req, res) => {
  try {
    if (!req.query.code) {
      req.client.logger.debug({ query: req.query, body: req.body });
      req.client.logger.error("Failed to login to dashboard! Check /logs folder for more details");
      return res.redirect(req.client.config.DASHBOARD.failureURL);
    }

    const redirectURL = req.client.states[req.query.state] || "/selector";
    const params = new URLSearchParams();
    params.set("grant_type", "authorization_code");
    params.set("code", req.query.code);
    params.set("redirect_uri", `${req.client.config.DASHBOARD.baseURL}/api/callback`);
    const response = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      body: params.toString(),
      headers: {
        Authorization: `Basic ${btoa(`${req.client.user.id}:${process.env.BOT_SECRET}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    // Fetch tokens (used to fetch user information's)
    const tokens = await response.json();

    // If the code isn't valid
    if (tokens.error || !tokens.access_token) {
      req.client.logger.debug(tokens);
      req.client.logger.error("Failed to login to dashboard! Check /logs folder for more details");
      return res.redirect(`/api/login&state=${req.query.state}`);
    }

    const userData = await fetchUserData(tokens.access_token);

    // Update session
    req.session.user = { ...userData.infos, ...{ guilds: userData.guilds } }; // {user-info, guilds: [{}]}
    res.redirect(redirectURL);
  } catch (error) {
    req.client.logger.error(error);
    res.redirect("/");
  }
});

async function fetchUserData(accessToken) {
  const infosResponse = await fetch("https://discordapp.com/api/users/@me", {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const guildsResponse = await fetch("https://discordapp.com/api/users/@me/guilds", {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const infos = await infosResponse.json();
  const guilds = await guildsResponse.json();

  return { infos, guilds };
}

module.exports = router;
