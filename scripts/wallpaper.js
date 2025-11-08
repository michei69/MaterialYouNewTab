/*
 * Material You NewTab
 * Copyright (c) 2023-2025 XengShi
 * Licensed under the GNU General Public License v3.0 (GPL-3.0)
 * You should have received a copy of the GNU General Public License along with this program.
 * If not, see <https://www.gnu.org/licenses/>.
 */


// -------------------------- Wallpaper -----------------------------
const dbName = "ImageDB";
const storeName = "backgroundImages";
const timestampKey = "lastUpdateTime"; // Key to store last update time
const imageTypeKey = "imageType"; // Key to store the type of image ("random" or "upload")

// Open IndexedDB database
function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = function (event) {
            const db = event.target.result;
            db.createObjectStore(storeName);
        };
        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject("Database error: " + event.target.errorCode);
    });
}

// Save image Blob, timestamp, and type to IndexedDB
async function saveImageToIndexedDB(imageBlob, isRandom) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);

        store.put(imageBlob, "backgroundImage"); // Save Blob
        store.put(new Date().toISOString(), timestampKey);
        store.put(isRandom ? "random" : "upload", imageTypeKey);

        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject("Transaction error: " + event.target.errorCode);
    });
}

// Load image Blob, timestamp, and type from IndexedDB
async function loadImageAndDetails() {
    const db = await openDatabase();
    return Promise.all([
        getFromStore(db, "backgroundImage"),
        getFromStore(db, timestampKey),
        getFromStore(db, imageTypeKey)
    ]);
}

function getFromStore(db, key) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readonly");
        const store = transaction.objectStore(storeName);
        const request = store.get(key);

        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject("Request error: " + event.target.errorCode);
    });
}

// Clear image data from IndexedDB
async function clearImageFromIndexedDB() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);
        store.delete("backgroundImage");
        store.delete(timestampKey);
        store.delete(imageTypeKey);

        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject("Delete error: " + event.target.errorCode);
    });
}

// Handle file input and save image as upload
document.getElementById("imageUpload").addEventListener("change", function (event) {
    const file = event.target.files[0];
    if (file) {
        const imageUrl = URL.createObjectURL(file); // Create temporary Blob URL
        const image = new Image();

        image.onload = function () {
            document.body.style.setProperty("--bg-image", `url(${imageUrl})`);
            saveImageToIndexedDB(file, false)
                .then(() => {
                    toggleBackgroundType(true);
                    URL.revokeObjectURL(imageUrl); // Clean up memory
                })
                .catch(error => console.error(error));
        };

        image.src = imageUrl;
    }
});

// Fetch and apply random image as background
const RANDOM_IMAGE_URL = "https://api.unsplash.com/photos/random?count=1&collections=1053828";

async function getDominantColorFromBlob(blob) {
    const img = new Image();
    img.src = URL.createObjectURL(blob);

    await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
    });

    // Scale down the image to reduce processing
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const width = 100;
    const height = Math.round((img.height / img.width) * 100);
    canvas.width = width;
    canvas.height = height;

    ctx.drawImage(img, 0, 0, width, height);

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    const colorCount = {};
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        if (a < 128) continue; // ignore transparent pixels
        const key = `${r},${g},${b}`;
        colorCount[key] = (colorCount[key] || 0) + 1;
    }

    let dominantColor = null;
    let maxCount = 0;
    for (const key in colorCount) {
        if (colorCount[key] > maxCount) {
            maxCount = colorCount[key];
            dominantColor = key;
        }
    }

    const rgb = dominantColor.split(',').map(Number);
    const hex = `#${((1 << 24) + (rgb[0] << 16) + (rgb[1] << 8) + rgb[2]).toString(16).slice(1)}`;
    return hex
}
async function applyRandomImage(showConfirmation = true) {
    if (showConfirmation && !(await confirmPrompt(
        translations[currentLanguage]?.confirmWallpaper || translations["en"].confirmWallpaper
    ))) {
        return;
    }
    try {
        const response = await fetch(RANDOM_IMAGE_URL, {
            headers: {
                "Authorization": "Client-ID 1351e7003b0e869c6d7b221fe548c25216b16571ad28866446c06196ba1902d7"
            }
        });
        const data = await response.json()
        const img = data[0].urls.raw
        const imgResponse = await fetch(img)
        const blob = await imgResponse.blob(); // Get Blob from response
        const imageUrl = URL.createObjectURL(blob);

        document.body.style.setProperty("--bg-image", `url(${imageUrl})`);
        applyCustomTheme(await getDominantColorFromBlob(blob))
        await saveImageToIndexedDB(blob, true);
        toggleBackgroundType(true);
        setTimeout(() => URL.revokeObjectURL(imageUrl), 2000); // Delay URL revocation
    } catch (error) {
        console.error("Error fetching random image:", error);
    }
}

// Function to update the background type attribute
function toggleBackgroundType(hasWallpaper, blob) {
    document.body.setAttribute("data-bg", hasWallpaper ? "wallpaper" : "color");
    getDominantColorFromBlob(blob).then(color => applyCustomTheme(color))
}

// Check and update image on page load
function checkAndUpdateImage() {
    loadImageAndDetails()
        .then(([blob, savedTimestamp, imageType]) => {
            const now = new Date();
            const lastUpdate = new Date(savedTimestamp);

            // No image or invalid data
            if (!blob || !savedTimestamp || isNaN(lastUpdate)) {
                toggleBackgroundType(false);
                return;
            }

            // Create a new Blob URL dynamically
            const imageUrl = URL.createObjectURL(blob);

            if (imageType === "upload") {
                document.body.style.setProperty("--bg-image", `url(${imageUrl})`);
                toggleBackgroundType(true, blob);
                return;
            }

            if (lastUpdate.getTime() - now.getTime() > 15 * 60 * 1000) {
                // Refresh random image after 15min
                applyRandomImage(false);
            } else {
                // Reapply the saved random image
                document.body.style.setProperty("--bg-image", `url(${imageUrl})`);
                toggleBackgroundType(true, blob);
            }

            // Clean up the Blob URL after setting the background
            setTimeout(() => URL.revokeObjectURL(imageUrl), 1500);
        })
        .catch((error) => {
            console.error("Error loading image details:", error);
            toggleBackgroundType(false);
        });
}

// Event listeners for buttons
document.getElementById("uploadTrigger").addEventListener("click", () =>
    document.getElementById("imageUpload").click()
);

document.getElementById("clearImage").addEventListener("click", async function () {
    try {
        const [blob] = await loadImageAndDetails();
        if (!blob) {
            await alertPrompt(translations[currentLanguage]?.Nobackgroundset || translations["en"].Nobackgroundset);
            return;
        }

        const confirmationMessage = translations[currentLanguage]?.clearbackgroundimage || translations["en"].clearbackgroundimage;
        if (await confirmPrompt(confirmationMessage)) {
            try {
                await clearImageFromIndexedDB();
                document.body.style.removeProperty("--bg-image");
                toggleBackgroundType(false);
            } catch (error) {
                console.error(error);
            }
        }
    } catch (error) {
        console.error(error);
    }
});
document.getElementById("randomImageTrigger").addEventListener("click", applyRandomImage);

// Start image check on page load
checkAndUpdateImage();
setInterval(() => {
    checkAndUpdateImage()
}, 15 * 60 * 1000);
// ------------------------ End of BG Image --------------------------