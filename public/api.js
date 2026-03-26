document.getElementById('analysisForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const analyzeBtn = document.getElementById('analyzeBtn');
    const resultDiv = document.getElementById('result');
    const diagnosisEl = document.getElementById('diagnosis');
    const suitabilityEl = document.getElementById('suitability');
    const reasoningEl = document.getElementById('reasoning');
    const clinicalNoteEl = document.getElementById('clinicalNote');

    const formData = new FormData();
    formData.append('image', document.getElementById('image').files[0]);

    const userAnswers = {
        gender: document.getElementById('gender').value || 'Unknown',
        age: document.getElementById('age').value || 'Unknown',
        painful: document.getElementById('painful').value || 'N/A',
        pus: document.getElementById('pus').value || 'N/A'
    };

    formData.append('user_answers', JSON.stringify(userAnswers));

    analyzeBtn.disabled = true;
    analyzeBtn.textContent = 'Analyzing...';
    resultDiv.textContent = 'Analyzing...';
    diagnosisEl.textContent = 'Analyzing...';
    suitabilityEl.textContent = 'Analyzing...';
    reasoningEl.textContent = 'Analyzing...';
    clinicalNoteEl.textContent = 'Analyzing...';

    try {
        const response = await fetch('/api/analyze', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            diagnosisEl.textContent = data.diagnosis || 'N/A';
            suitabilityEl.textContent = data.suitability || 'N/A';
            reasoningEl.textContent = data.reasoning || 'N/A';
            clinicalNoteEl.textContent = data.clinical_note || 'N/A';
            resultDiv.textContent = JSON.stringify(data, null, 2);
        } else {
            diagnosisEl.textContent = 'Error';
            suitabilityEl.textContent = 'N/A';
            reasoningEl.textContent = 'N/A';
            clinicalNoteEl.textContent = 'N/A';
            resultDiv.textContent = `Error: ${data.error}`;
        }
    } catch (error) {
        diagnosisEl.textContent = 'Error';
        suitabilityEl.textContent = 'N/A';
        reasoningEl.textContent = 'N/A';
        clinicalNoteEl.textContent = 'N/A';
        resultDiv.textContent = `Error: ${error.message}`;
    } finally {
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = 'Analyze';
    }
});
