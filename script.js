
async function analyze() {
  loading.textContent = 'Analyzing image...';

  try {
    const detection = await faceapi
      .detectSingleFace(imgContainer.firstChild)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      loading.textContent = 'No face detected. Try another image.';
      return;
    }

    const desc = detection.descriptor;
    const list2 = structuredClone(list);

    // Calculate similarity scores
    for (let j = 0; j < list2.length; j++) {
      const len = list2[j].length;

      if (len > 1) {
        list2[j][0][1] =
          cos(list2[j][0][1], desc) * 100;
      }

      for (let k = 0; k < list2[j][len - 1].length; k++) {
        list2[j][len - 1][k][1] =
          cos(list2[j][len - 1][k][1], desc) * 100;
      }
    }

    // Collect all reference images
    const matches = [];

    for (const group of list2) {
      const len = group.length;

      if (len > 1) {
        matches.push({
          name: group[0][0],
          score: group[0][1],
          type: 'basic'
        });
      }

      for (const item of group[len - 1]) {
        matches.push({
          name: item[0],
          score: item[1],
          type: 'regular'
        });
      }
    }

    // Sort by similarity
    matches.sort((a, b) => b.score - a.score);

    // Remove duplicate names
    const uniqueMatches = [];
    const seen = new Set();

    for (const match of matches) {
      if (
        !seen.has(match.name) &&
        Number.isFinite(match.score)
      ) {
        seen.add(match.name);
        uniqueMatches.push(match);
      }
    }

    // Display results
    const resultsContainer =
      document.getElementById('resultsContainer');

    resultsContainer.replaceChildren();

    function addSection(title, items) {
      if (!items.length) return;

      const section = document.createElement('section');

      const heading = document.createElement('h2');
      heading.textContent = title;
      section.appendChild(heading);

      items.forEach((item, index) => {
        const container = document.createElement('div');

        const img = document.createElement('img');

        img.src = item.type === 'basic'
          ? `faces_lowres/basic/${item.name.toLowerCase()}m.jpg`
          : `faces_lowres/${item.name.toLowerCase()}m.jpg`;

        img.alt = 'Reference image';
        img.style.width = '120px';

        const name = document.createElement('h3');
        name.textContent = `${index + 1}. ${item.name}`;

        const score = document.createElement('p');
        score.textContent =
          `${item.score.toFixed(2)}% descriptor similarity`;

        container.append(img, name, score);
        section.appendChild(container);
      });

      resultsContainer.appendChild(section);
    }

    addSection(
      'Closest Visual Match',
      uniqueMatches.slice(0, 1)
    );

    addSection(
      'Secondary Visual Matches',
      uniqueMatches.slice(1, 6)
    );

    addSection(
      'Additional Visual Matches',
      uniqueMatches.slice(6, 16)
    );

    addSection(
      'Similarity Ranking',
      uniqueMatches.slice(16, 26)
    );

    loading.textContent = 'Analysis complete!';

    console.log('Similarity Ranking:', uniqueMatches);

  } catch (error) {
    console.error(error);
    loading.textContent =
      'An error occurred while analyzing the image.';
  }
}
