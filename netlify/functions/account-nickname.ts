export default async (request: Request) => {
  if (request.method !== "GET") {
    return new Response(
      JSON.stringify({ error: "Method Not Allowed" }),
      {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          "Allow": "GET",
        },
      }
    );
  }

  const appId = process.env.DERIV_APP_ID;
  const token = process.env.DERIV_TOKEN;

  if (!appId || !token) {
    return new Response(
      JSON.stringify({
        error: "Missing DERIV_APP_ID or DERIV_TOKEN",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }

  const response = await fetch(
    "https://api.derivws.com/account/v1/nickname",
    {
      method: "GET",
      headers: {
        "Deriv-App-ID": appId,
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
      },
    }
  );

  const body = await response.text();

  return new Response(body, {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("content-type") || "application/json",
      "Cache-Control": "no-store",
    },
  });
};
