const express = require("express");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const cors = require("cors");

const app = express();
app.use(cors({ origin: "http://localhost:3000", methods: ["GET", "POST"] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Define clinic credentials
const clinics = {
  Delhi: "Delhi123",
  Gurgaon: "Gurgaon123",
  Kolkata: "Kolkata123",
  Noida: "Noida123",
  Chandigarh: "Chandigarh123",
  Kochi: "Kochi123",
  Jaipur: "Jaipur123",
  Chennai: "Chennai123",
  Hyderabad: "Hyderabad123",
  Banglore: "Banglore123",
  Lucknow: "Lucknow123",
  Guwahati: "Guwahati123",
  Calicut: "Calicut123",
  Coimatore: "Coimatore123",
  Salem: "Salem123",
};

// Multer storage configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log("Uploading file to 'uploads/' directory");
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    console.log(`Renaming file to: ${Date.now()}-${file.originalname}`);
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage }).array("images");

// Synology NAS URL and credentials
const SYNOLOGY_URL = "https://dhiinternationalnas.direct.quickconnect.to:5004/";
const SYNOLOGY_CREDENTIALS = { account: "dhitest", passwd: "DhiTest#308" };
let synologySid = "";

// Authenticate with Synology NAS
async function authenticateSynology() {
  try {
    console.log("Authenticating with Synology NAS...");
    const response = await axios.get(`${SYNOLOGY_URL}/webapi/auth.cgi`, {
      params: {
        api: "SYNO.API.Auth",
        version: 3,
        method: "login",
        session: "FileStation",
        format: "cookie",
        ...SYNOLOGY_CREDENTIALS,
      },
    });

    if (response.data.success) {
      synologySid = response.data.data.sid;
      console.log("Authentication successful, SID:", synologySid);
      return true;
    } else {
      console.error("Authentication failed");
      throw new Error("Authentication failed");
    }
  } catch (error) {
    console.error("Authentication error:", error);
    throw error;
  }
}

// Upload file to Synology NAS
const { spawnSync } = require("child_process");

async function uploadFileToSynology(path, file) {
  console.log(`Uploading file to Synology NAS at path: ${path}`);

  // Get current timestamp in milliseconds
  const timestamp = Date.now();

  // Build the curl command
  const curlCommand = [
    "-X", "POST", `${SYNOLOGY_URL}/webapi/entry.cgi`,
    "-H", "Content-Type: multipart/form-data",
    "-F", "api=SYNO.FileStation.Upload",
    "-F", "version=2",
    "-F", "method=upload",
    "-F", `path=${path}`,
    "-F", "create_parents=true",
    "-F", "overwrite=overwrite",  // Overwrite existing files
    "-F", `mtime=${timestamp}`,
    "-F", `crtime=${timestamp}`,
    "-F", `atime=${timestamp}`,
    "-F", `file=@${file.path}`,
    "-b", `id=${synologySid}`,
  ];

  try {
    // Execute the curl command
    const result = spawnSync("curl", curlCommand, { encoding: "utf-8" });

    if (result.error) {
      throw new Error(`Curl execution failed: ${result.error.message}`);
    }

    console.log("Curl Output:", result.stdout);
    console.error("Curl Errors:", result.stderr);

    // Delete the local file after successful upload
    fs.unlinkSync(file.path);
    console.log("File removed from local server");
  } catch (error) {
    console.error("Error uploading file:", error);
    throw error;
  }
}

// Login route
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (clinics[username] && clinics[username] === password) {
    res.status(200).json({ success: true, clinicName: username });
  } else {
    res.status(401).json({ success: false, message: "Invalid credentials" });
  }
});

// Form submission route
app.post("/submit-form", upload, async (req, res) => {
  console.log("Received form data:", req.body);
  console.log("Received files:", req.files);
  try {
    console.log("Form submission received:", req.body);
    await authenticateSynology();

    const { clinicName, treatment, year, month, date, patientName, patientMobile, selectedDay } = req.body;
    const images = req.files;
    const folderPath = `/DHITEST/${clinicName}/${treatment}/${year}/${month}/date_${date}_${patientName}_${patientMobile}/${selectedDay}`;
    console.log("Generated folder path:", folderPath);

    console.log(images);
    for (const file of images) {
      console.log(`Uploading image: ${file.originalname}`);
      await uploadFileToSynology(folderPath, file);
    }

    console.log("Form submitted successfully");
    res.status(200).json({ success: true, message: "Form submitted successfully" });
  } catch (error) {
    console.error("Error in form submission:", error);
    res.status(500).json({ error: error.message });
  }
});

// Server setup
app.listen(3001, '0.0.0.0', () => console.log('Server running...'));

