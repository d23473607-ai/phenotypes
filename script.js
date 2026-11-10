
let list;

const loading = document.getElementById('loading');
const imgContainer = document.getElementById('imgContainer');

async function displayImg(url) {
  const img = new Image();
  img.src = url;
  await img.decode();
  imgContainer.replaceChildren(img);
}

dot = (a, b) =>
  a.reduce((acc, n, i) => acc + (n * b[i]), 0);

cos = (a, b) =>
  dot(a, b) / Math.sqrt(dot(a, a) * dot(b, b));

async function analyze() {
  loading.textContent = 'Analyzing image...';

  const detection = await faceapi
    .detectSingleFace(imgContainer.firstChild)
    .withFaceLandmarks()
    .withAgeAndGender()
    .withFaceDescriptor();

  if (!detection) {
    loading.textContent = 'No face detected. Try another image.';
    return;
  }

  const desc = detection.descriptor;

  let sex = detection.gender;

  if (confirm(
    `The program thinks you are ${sex} with ${
      (detection.genderProbability * 100).toFixed(2)
    }% confidence. Is this correct?`
  )) {
    sex = sex.substring(0, 1);
  } else {
    sex = sex === 'female' ? 'm' : 'f';
  }

  const i = sex === 'm' ? 1 : 2;
  const list2 = structuredClone(list);

  // Calculate visual similarity scores
  for (let j = 0; j < list2.length; j++) {
    const len = list2[j].length;

    if (len > 1) {
      list2[j][0][i] =
        cos(list2[j][0][i], desc) * 100;
    }

    for (let k = 0; k < list2[j][len - 1].length; k++) {
      list2[j][len - 1][k][i] =
        cos(list2[j][len - 1][k][i], desc) * 100;
    }

    list2[j][len - 1].sort(
      (a, b) => b[i] - a[i]
    );
  }

  // Collect all visual matches
  const matches = [];

  for (const group of list2) {
    const len = group.length;

    if (len > 1) {
      matches.push({
        name: group[0][0],
        score: group[0][i],
        type: 'basic'
      });
    }

    for (const item of group[len - 1]) {
      matches.push({
        name: item[0],
        score: item[i],
        type: 'regular'
      });
    }
  }

  // Sort results by visual similarity
  matches.sort((a, b) => b.score - a.score);

  // Remove duplicate entries
  const uniqueMatches = [];
  const seen = new Set();

  for (const match of matches) {
    if (!seen.has(match.name)) {
      seen.add(match.name);
      uniqueMatches.push(match);
    }
  }

  // Divide results into categories
  const bestMatch = uniqueMatches.slice(0, 1);
  const secondaryMatches = uniqueMatches.slice(1, 6);
  const additionalMatches = uniqueMatches.slice(6, 16);

  // Display results
  const resultsContainer =
    document.getElementById('resultsContainer');

  resultsContainer.innerHTML = `
    <h2>Visual Comparison Results</h2>
    <p>
      The following results show numerical similarities
      between the submitted image and reference images.
      Similarity scores do not establish ancestry,
      ethnicity or biological phenotype.
    </p>
  `;

  function renderSection(title, items) {
    if (items.length === 0) return;

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

      img.src = item.type === 'basic'
        ? `faces_lowres/basic/${item.name.toLowerCase()}${sex}.jpg`
        : `faces_lowres/${item.name.toLowerCase()}${sex}.jpg`;

      img.alt = 'Reference image';
      img.style.width = '120px';

      const info = document.createElement('div');

      const name = document.createElement('h3');
      name.textContent = item.name;

      const score = document.createElement('p');
      score.textContent =
        `${item.score.toFixed(2)}% visual similarity`;

      info.append(name, score);
      container.append(img, info);

      section.appendChild(container);
    }

    resultsContainer.appendChild(section);
  }

  renderSection('Best Visual Match', bestMatch);

  renderSection(
    'Secondary Visual Matches',
    secondaryMatches
  );

  renderSection(
    'Additional Visual Comparisons',
    additionalMatches
  );

  loading.textContent = 'Results!';

  console.log('Visual Comparison Results:', uniqueMatches);
}

// Image upload
document.getElementById('imgInp').onchange = async function() {
  const [file] = this.files;

  if (file) {
    await displayImg(URL.createObjectURL(file));

    if (document.getElementById('loader') == null) {
      analyze();
    }
  }
};

// Load face-api models and reference database
(async () => {
  await faceapi.loadSsdMobilenetv1Model('/models');
  await faceapi.loadFaceLandmarkModel('/models');
  await faceapi.loadFaceRecognitionModel('/models');
  await faceapi.loadAgeGenderModel('/models');

  const response = await fetch('list.json');
  const text = await response.text();

  list = JSON.parse(text);

  // Decode base64 descriptors
  hexToF32Arr = (str) =>
    new Float32Array(
      new Uint8Array(
        [...atob(str)].map(c => c.charCodeAt(0))
      ).buffer
    );

  hexToF32 = (arr) => [
    arr[0],
    hexToF32Arr(arr[1]),
    hexToF32Arr(arr[2])
  ];

  for (let i = 0; i < list.length; i++) {
    const len = list[i].length;

    if (len > 1) {
      list[i][0] = hexToF32(list[i][0]);
    }

    for (let j = 0; j < list[i][len - 1].length; j++) {
      list[i][len - 1][j] =
        hexToF32(list[i][len - 1][j]);
    }
  }

  loading.textContent = 'Models fetched!';

  document.getElementById('loader').remove();

  if (imgContainer.children.length > 0) {
    analyze();
  }
})();

// Generate descriptor for a reference image
async function getDesc(str) {
  await displayImg(`faces/${str.toLowerCase()}.jpg`);

  const detection = await faceapi
    .detectSingleFace(imgContainer.firstChild)
    .withFaceLandmarks()
    .withFaceDescriptor();

  return btoa(
    String.fromCharCode(
      ...(new Uint8Array(detection.descriptor.buffer))
    )
  );
}

// Generate descriptors for all reference images
async function generateDescriptors() {
  if (document.getElementById('loader') == null) {

    let list2 = structuredClone(list);

    const sex = ['m', 'f'];

    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < list2.length; j++) {
        const len2 = list2[j].length;

        if (len2 > 1) {
          list2[j][0][i + 1] = await getDesc(
            'basic/' + list2[j][0][0] + sex[i]
          );
        }

        for (let k = 0; k < list2[j][len2 - 1].length; k++) {
          list2[j][len2 - 1][k][i + 1] =
            await getDesc(
              list2[j][len2 - 1][k][0] + sex[i]
            );
        }
      }
    }

    loading.textContent = JSON.stringify(list2, null, 2);

  } else {
    alert('Please wait until the models are fetched.');
  }
}
