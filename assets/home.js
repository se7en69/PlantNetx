const form = document.getElementById('dashboardForm');
const resultOutput = document.getElementById('resultOutput');

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const formData = new FormData(form);

  // Extracting values
  const singleValue = formData.get('singleValue');
  const multipleValues = formData.get('multipleValues').split(',');
  const dropdown = formData.get('dropdown');

  // Rendering results
  resultOutput.innerHTML = `
    <h3>Submitted Data:</h3>
    <p><strong>Single Value:</strong> ${singleValue || 'None'}</p>
    <p><strong>Multiple Values:</strong> ${multipleValues.filter(val => val.trim()).join(', ') || 'None'}</p>
    <p><strong>Selected Option:</strong> ${dropdown || 'None'}</p>
  `;
});
