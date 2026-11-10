'use strict';

// ============================================
// GLOBAL VARIABLES
// ============================================

let list = [];
let isReady = false;
let isAnalyzing = false;

const loading = document.getElementById('loading');
const imgContainer = document.getElementById('imgContainer');
const resultsContainer = document.getElementById('resultsContainer');

// ============================================
// STATUS MANAGEMENT
// ============================================

function setStatus(message) {
  if (loading) loading.textContent = message;
}

function showError(message, error) {
  console.error(message, error || '');
  setStatus(message);
}

// ============================================
// IMAGE DISPLAY
// ============================================

async function displayImg(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      imgContainer.replaceChildren(img);
      resolve(img);
    };

    img.onerror = () => {
      reject(new Error('Image could not be loaded: ' + url));
    };

    img.src = url;
  });
}

// ============================================
// DESCRIPTOR SIMILARITY
// ============================================

function dot(a, b) {
  if (!a || !b || a.length !== b.length) {
    throw new Error('Invalid descriptors.');
  }

  let result = 0;

  for (let i = 0; i < a.length; i++) {
    result += a[i] * b[i];
  }

  return result;
}

function cosineSimilarity(a, b) {
  const denominator = Math.sqrt(
    dot(a, a) * dot(b, b)
  );

  if (!denominator || !Number.isFinite(denominator)) {
    return null;
  }

  return (dot(a, b) / denominator) * 100;
}

// ============================================
// RESULTS DISPLAY
// ============================================

function renderSection(title, items, sex) {
  if (!items.length) return;

  const section = document.createElement('section');

  const heading = document.createElement('h2');
  heading.textContent = title;

  section.appendChild(heading);

  for (const item of items) {
    const container = document.createElement('div');

    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.gap = '15px';
    container.style.marginBottom = '15px';

    const img = document.createElement('img');

    const folder = item.type === 'basic'
      ? 'basic/'
      : '';

    img.src =
      `faces_lowres/${folder}${item.name.toLowerCase()}${sex}.jpg`;

    img.alt = 'Reference image';
    img.loading = 'lazy';
    img.style.width = '120px';
    img.style.height = 'auto';

    img.onerror = () => {
      img.style.display = 'none';
    };

    const info = document.createElement('div');

    const name = document.createElement('h3');
    name.textContent = item.name;

    const score = document.createElement('p');
    score.textContent =
      `${item.score.toFixed(2)}% descriptor similarity`;

    info.append(name, score);
    container.append(img, info);

    section.appendChild(container);
  }

  resultsContainer.appendChild(section);
}

// ============================================
// IMAGE ANALYSIS
// ============================================

async function analyze() {
  if (!isReady || isAnalyzing) return;

  const inputImage = imgContainer.firstElementChild;

  if (!inputImage) {
    setStatus('Please select an image.');
    return;
  }

  if (!inputImage.complete || !inputImage.naturalWidth) {
    setStatus('Please wait for the image to load.');
    return;
  }

  isAnalyzing = true;
  setStatus('Analyzing image...');

  resultsContainer.replaceChildren();

  try {
    const detection = await faceapi
      .detectSingleFace(inputImage)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      setStatus('No face detected. Please try another image.');
      return;
    }

    // Preserve the original gender selection
    const genderDetection = await faceapi
      .detectSingleFace(inputImage)
      .withFaceLandmarks()
      .withAgeAndGender();

    let sex = genderDetection?.gender === 'female' ? 'f' : 'm';

    if (genderDetection) {
      const confirmed = confirm(
        `The program thinks you are ${genderDetection.gender} ` +
        `with ${(genderDetection.genderProbability * 100).toFixed(2)}% confidence. Is this correct?`
      );

      if (!confirmed) {
        sex = sex === 'f' ? 'm' : 'f';
      }
    }

    const descriptor = detection.descriptor;
    const descriptorIndex = sex === 'm' ? 1 : 2;

    const matches = [];

    // Compare all reference descriptors
    for (const group of list) {
      const groupLength = group.length;

      if (groupLength > 1) {
        const score = cosineSimilarity(
          group[0][descriptorIndex],
          descriptor
        );

        if (score !== null) {
          matches.push({
            name: group[0][0],
            score,
            type: 'basic'
          });
        }
      }

      const references = group[groupLength - 1];

      for (const reference of references) {
        const score = cosineSimilarity(
          reference[descriptorIndex],
          descriptor
        );

        if (score !== null) {
          matches.push({
            name: reference[0],
            score,
            type: 'regular'
          });
        }
      }
    }

    // Sort results
    matches.sort((a, b) => b.score - a.score);

    // Remove duplicate names
    const seen = new Set();

    const uniqueMatches = matches.filter(item => {
      const key = item.name.toLowerCase();

      if (seen.has(key)) return false;

      seen.add(key);
      return true;
    });

    // Display results
    const description = document.createElement('p');

    description.textContent =
      'Results represent numerical similarities between facial descriptors and reference images. They do not establish biological phenotype, ancestry or ethnicity.';

    resultsContainer.appendChild(description);

    renderSection(
      'Closest Visual Match',
      uniqueMatches.slice(0, 1),
      sex
    );

    renderSection(
      'Secondary Visual Matches',
      uniqueMatches.slice(1, 6),
      sex
    );

    renderSection(
      'Additional Visual Matches',
      uniqueMatches.slice(6, 16),
      sex
    );

    renderSection(
      'Similarity Ranking',
      uniqueMatches.slice(16, 26),
      sex
    );

    setStatus('Analysis completed successfully.');

    console.log('Visual comparison results:', uniqueMatches);

  } catch (error) {
    showError('Analysis failed. Please try another image.', error);

  } finally {
    isAnalyzing = false;
  }
}

// ============================================
// IMAGE UPLOAD
// ============================================

const imgInp = document.getElementById('imgInp');

if (imgInp) {
  imgInp.addEventListener('change', async function() {
    const file = this.files?.[0];

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setStatus('Please select a valid image file.');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setStatus('Image is too large. Maximum size is 15 MB.');
      return;
    }

    setStatus('Loading image...');

    try {
      const url = URL.createObjectURL(file);

      await displayImg(url);

      if (isReady) {
        await analyze();
      } else {
        setStatus('Image loaded. Waiting for models...');
      }

    } catch (error) {
      showError('Could not load the selected image.', error);
    }
  });
}

// ============================================
// BASE64 DESCRIPTOR DECODING
// ============================================

function decodeDescriptor(encoded) {
  if (typeof encoded !== 'string') {
    throw new Error('Invalid descriptor format.');
  }

  const binary = atob(encoded);

  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  if (bytes.byteLength % 4 !== 0) {
    throw new Error('Invalid descriptor length.');
  }

  const descriptor = new Float32Array(bytes.buffer);

  if (descriptor.length !== 128) {
    throw new Error('Unexpected descriptor dimensions.');
  }

  return descriptor;
}

function decodeReference(arr) {
  if (!Array.isArray(arr) || arr.length < 3) {
    throw new Error('Invalid reference entry.');
  }

  return [
    arr[0],
    decodeDescriptor(arr[1]),
    decodeDescriptor(arr[2])
  ];
}

// ============================================
// INITIALIZATION
// ============================================

async function initialize() {
  try {
    setStatus('Loading face recognition models...');

    await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
    await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
    await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
    await faceapi.nets.ageGenderNet.loadFromUri('/models');

    setStatus('Loading reference database...');

    const response = await fetch('list.json');

    if (!response.ok) {
      throw new Error(
        `Database loading failed: HTTP ${response.status}`
      );
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error('Invalid database format.');
    }

    list = data.map(group => {
      if (!Array.isArray(group) || !group.length) {
        throw new Error('Invalid reference group.');
      }

      const decoded = structuredClone(group);

      const lastIndex = decoded.length - 1;

      if (lastIndex > 0) {
        decoded[0] = decodeReference(decoded[0]);
      }

      decoded[lastIndex] = decoded[lastIndex].map(
        decodeReference
      );

      return decoded;
    });

    isReady = true;

    setStatus('Models and database loaded successfully!');

    const loader = document.getElementById('loader');

    if (loader) loader.remove();

    if (imgContainer?.firstElementChild) {
      await analyze();
    }

  } catch (error) {
    showError(
      'Initialization failed. Check models, list.json and server paths.',
      error
    );
  }
}

// ============================================
// START APPLICATION
// ============================================

initialize();
