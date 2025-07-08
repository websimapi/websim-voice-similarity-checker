import Meyda from 'meyda';

// A simple Dynamic Time Warping implementation
// This avoids needing a separate library and handles the module complexity.
class DTW {
    constructor() {
        this.distanceMatrix = null;
        this.path = null;
    }

    // Computes the Euclidean distance between two vectors
    _euclideanDistance(a, b) {
        return Math.sqrt(a.reduce((sum, val, i) => sum + (val - b[i]) ** 2, 0));
    }

    compute(series1, series2) {
        const n = series1.length;
        const m = series2.length;
        this.distanceMatrix = Array(n).fill(null).map(() => Array(m).fill(Infinity));

        this.distanceMatrix[0][0] = this._euclideanDistance(series1[0], series2[0]);

        for (let i = 1; i < n; i++) {
            this.distanceMatrix[i][0] = this._euclideanDistance(series1[i], series2[0]) + this.distanceMatrix[i - 1][0];
        }

        for (let j = 1; j < m; j++) {
            this.distanceMatrix[0][j] = this._euclideanDistance(series1[0], series2[j]) + this.distanceMatrix[0][j - 1];
        }

        for (let i = 1; i < n; i++) {
            for (let j = 1; j < m; j++) {
                const cost = this._euclideanDistance(series1[i], series2[j]);
                this.distanceMatrix[i][j] = cost + Math.min(
                    this.distanceMatrix[i - 1][j],      // Insertion
                    this.distanceMatrix[i][j - 1],      // Deletion
                    this.distanceMatrix[i - 1][j - 1]   // Match
                );
            }
        }
        
        // The DTW distance is the value in the top-right corner of the matrix
        return this.distanceMatrix[n - 1][m - 1];
    }
}


const fileInput1 = document.getElementById('audioFile1');
const fileInput2 = document.getElementById('audioFile2');
const fileName1 = document.getElementById('fileName1');
const fileName2 = document.getElementById('fileName2');
const compareBtn = document.getElementById('compareBtn');
const resultDiv = document.getElementById('result');
const statusText = document.getElementById('statusText');
const scoreContainer = document.getElementById('scoreContainer');
const similarityScoreEl = document.getElementById('similarityScore');

let audioFile1 = null;
let audioFile2 = null;

const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function updateFileName(input, nameEl) {
    if (input.files.length > 0) {
        nameEl.textContent = input.files[0].name;
        nameEl.style.color = 'var(--text-color)';
    } else {
        nameEl.textContent = 'No file selected';
        nameEl.style.color = 'var(--light-text-color)';
    }
}

fileInput1.addEventListener('change', () => {
    audioFile1 = fileInput1.files[0];
    updateFileName(fileInput1, fileName1);
});
fileName1.addEventListener('click', () => fileInput1.click());


fileInput2.addEventListener('change', () => {
    audioFile2 = fileInput2.files[0];
    updateFileName(fileInput2, fileName2);
});
fileName2.addEventListener('click', () => fileInput2.click());


async function getAudioFeatures(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const audioData = event.target.result;
                const audioBuffer = await audioContext.decodeAudioData(audioData);

                const meydaAnalyzer = Meyda.createMeydaAnalyzer({
                    audioContext: audioContext,
                    source: audioBuffer,
                    bufferSize: 512,
                    featureExtractors: ["mfcc"],
                    callback: (features) => {
                        resolve(features.mfcc);
                    },
                });
                meydaAnalyzer.start();
            } catch (e) {
                reject(e);
            }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

compareBtn.addEventListener('click', async () => {
    if (!audioFile1 || !audioFile2) {
        alert('Please select two audio files.');
        return;
    }

    compareBtn.disabled = true;
    compareBtn.textContent = 'Analyzing...';
    resultDiv.classList.remove('hidden');
    scoreContainer.classList.add('hidden');

    try {
        statusText.textContent = 'Extracting features from audio 1...';
        const features1 = await getAudioFeatures(audioFile1);

        statusText.textContent = 'Extracting features from audio 2...';
        const features2 = await getAudioFeatures(audioFile2);
        
        statusText.textContent = 'Comparing voice prints...';
        
        // This is a short delay to ensure the UI updates before the potentially blocking DTW calculation
        await new Promise(resolve => setTimeout(resolve, 50));

        const dtw = new DTW();
        // The MFCCs are returned as a flat array per frame. We need to group them.
        // Meyda returns 13 coefficients by default.
        const mfcc1 = chunk(features1, 13);
        const mfcc2 = chunk(features2, 13);
        
        const distance = dtw.compute(mfcc1, mfcc2);
        
        // Normalize the distance. This is heuristic.
        // Lower distance means more similar. We convert it to a percentage.
        // We divide by the number of frames to get an average distance per frame.
        const normalizedDistance = distance / (mfcc1.length + mfcc2.length);

        // This scaling factor is empirical and might need tuning.
        // It converts the distance into a 0-1 similarity score.
        const similarity = Math.max(0, 1 - normalizedDistance / 10); 
        
        const percentage = Math.round(similarity * 100);

        statusText.textContent = 'Done!';
        similarityScoreEl.textContent = `${percentage}%`;
        scoreContainer.classList.remove('hidden');

    } catch (error) {
        console.error('An error occurred during comparison:', error);
        statusText.textContent = `Error: ${error.message}. Please try different audio files.`;
    } finally {
        compareBtn.disabled = false;
        compareBtn.textContent = 'Compare Voices';
    }
});

// Helper function to split an array into chunks
function chunk(array, size) {
    const chunked_arr = [];
    for (let i = 0; i < array.length; i++) {
        const last = chunked_arr[chunked_arr.length - 1];
        if (!last || last.length === size) {
            chunked_arr.push([array[i]]);
        } else {
            last.push(array[i]);
        }
    }
    return chunked_arr;
}

