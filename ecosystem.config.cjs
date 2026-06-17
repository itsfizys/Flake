module.exports = {

  apps: [
    {
      name: "bot",
      script: "node",
      args: "src/bot.js",
      interpreter: "none",
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
