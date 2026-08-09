# Netlify deployment

## GitHub method (recommended)

1. Push this project to your GitHub repository.
2. In Netlify, choose **Add new project** / **Import an existing project**.
3. Select GitHub and choose the repository.
4. Netlify should detect the Vite project.
5. Build command: `npm run build`
6. Publish directory: `dist`
7. Deploy.

The included `netlify.toml` already contains these settings and the SPA redirect.

## Important

The Deriv WebSocket connection is made by the browser directly to Deriv.
The user's Deriv API token is not intended to be sent to your Netlify server.

After deployment:
- Open the Netlify URL.
- Press **Connect Deriv**.
- Enter a Deriv API token.
- Authorize.
- The app should display the live account balance and currency.
