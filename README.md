
## Deriv live account connection

The app now includes a real Deriv WebSocket connection using App ID `1089` by default.
Open **Connect Deriv**, enter a Deriv API token with the required permissions, and the
browser connects directly to Deriv over `wss://ws.derivws.com/websockets/v3`.

After authorization, the app subscribes to the live `balance` stream and displays the
returned account balance, currency, account type, and login ID. The token is not sent
to this project's server; it is used by the browser WebSocket connection.
