require("dotenv").config();

const express = require("express");
const fetch = require("node-fetch"); // node-fetch@2
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const { API_KEY, PHARMACY_ID } = process.env;
const BASE_URL = "https://pharmacyapi.datascanpharmacy.com/api";

let cachedToken = null;

/* ================= TOKEN ================= */

async function generateToken() {
  const response = await fetch(
    `${BASE_URL}/Auth/GetToken?pharmacyId=${PHARMACY_ID}`,
    {
      method: "GET",
      headers: {
        "X-API-KEY": API_KEY,
        Accept: "text/plain"
      }
    }
  );

  if (!response.ok) {
    throw new Error("Token generation failed");
  }

  const data = await response.json();
  cachedToken = data.accessToken;
  return cachedToken;
}

async function getToken() {
  if (cachedToken) return cachedToken;
  return await generateToken();
}

/* ================= API WRAPPER ================= */

async function apiFetch(url) {
  let token = await getToken();

  let response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "text/plain"
    }
  });

  if (response.status === 401) {
    token = await generateToken();

    response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "text/plain"
      }
    });
  }

  return response;
}

/* ================= SEARCH ================= */

app.get("/search", async (req, res) => {
  try {
    const { search } = req.query;

    if (!search) {
      return res.status(400).json({ error: "Search term required." });
    }

    const searchUrl =
      `${BASE_URL}/Drug/SearchDrug?search=${encodeURIComponent(search)}&pageSize=50&pageIndex=0`;

    const response = await apiFetch(searchUrl);

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();
    res.json(data);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= CALCULATE ================= */

app.get("/calculate", async (req, res) => {
  try {
    const { drugId, drugQty, daySupply } = req.query;

    if (!drugId || !drugQty || !daySupply) {
      return res.status(400).json({
        error: "drugId, quantity, and daySupply required."
      });
    }

    const uacUrl =
      `${BASE_URL}/Drug/CalculateDrugUAC?drugId=${drugId}&drugQty=${drugQty}&daySupply=${daySupply}`;

    const response = await apiFetch(uacUrl);

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();
    res.json(data);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

