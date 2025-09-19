const axios = require('axios');

async function testPayment() {
  try {
    console.log('Testing payment API...');
    
    const response = await axios.post('http://localhost:4000/api/payments/create', {
      courseId: 5,
      amount: 5000,
      currency: 'XAF',
      phone: '670000000',
      paymentMethod: 'fapshi'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI3IiwidXNlcm5hbWUiOiJJenp5IiwiZW1haWwiOiJpenp5QGdtYWlsLmNvbSIsInJvbGUiOiJzdHVkZW50IiwiaWF0IjoxNzU4MjUxODAyLCJleHAiOjE3NTgzMzgyMDJ9.RNVORUAhwsB-KHyJeZnBjuqEJunzFXQUGoYWB8O8rUc'
      }
    });

    console.log('Payment response:', response.data);
  } catch (error) {
    console.error('Payment error details:');
    console.error('Status:', error.response?.status);
    console.error('Data:', error.response?.data);
    console.error('Message:', error.message);
    console.error('Full error:', error);
  }
}

testPayment();
