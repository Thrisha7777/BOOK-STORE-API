const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'your-secret-key'; // In production, use environment variables

// Database setup (In-memory for demonstration)
const db = {
  books: [
    { 
      isbn: '9780123456789', 
      title: 'Node.js Fundamentals', 
      author: 'John Developer', 
      price: 29.99,
      description: 'A comprehensive guide to Node.js development'
    },
    { 
      isbn: '9780987654321', 
      title: 'Express.js in Action', 
      author: 'Jane Programmer', 
      price: 24.99,
      description: 'Learn how to build web applications with Express.js'
    },
    { 
      isbn: '9781122334455', 
      title: 'Modern JavaScript', 
      author: 'John Developer', 
      price: 34.99,
      description: 'Advanced JavaScript techniques for modern web development'
    }
  ],
  users: [],
  reviews: []
};

// Middleware
app.use(bodyParser.json());

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ message: 'Access denied' });
  
  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).json({ message: 'Invalid token' });
  }
};

// Task 1: Get the book list available in the shop
app.get('/api/books', (req, res) => {
  res.json(db.books);
});

// Task 2: Get the books based on ISBN
app.get('/api/books/isbn/:isbn', (req, res) => {
  const book = db.books.find(b => b.isbn === req.params.isbn);
  if (!book) {
    return res.status(404).json({ message: 'Book not found' });
  }
  res.json(book);
});

// Task 3: Get all books by Author
app.get('/api/books/author/:author', (req, res) => {
  const books = db.books.filter(b => 
    b.author.toLowerCase().includes(req.params.author.toLowerCase())
  );
  
  if (books.length === 0) {
    return res.status(404).json({ message: 'No books found for this author' });
  }
  
  res.json(books);
});

// Task 4: Get all books based on Title
app.get('/api/books/title/:title', (req, res) => {
  const books = db.books.filter(b => 
    b.title.toLowerCase().includes(req.params.title.toLowerCase())
  );
  
  if (books.length === 0) {
    return res.status(404).json({ message: 'No books found with this title' });
  }
  
  res.json(books);
});

// Task 5: Get book Review
app.get('/api/books/:isbn/reviews', (req, res) => {
  const bookReviews = db.reviews.filter(r => r.isbn === req.params.isbn);
  
  if (bookReviews.length === 0) {
    return res.status(404).json({ message: 'No reviews found for this book' });
  }
  
  res.json(bookReviews);
});

// Task 6: Register New user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Basic validation
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    
    // Check if user already exists
    if (db.users.some(user => user.email === email)) {
      return res.status(400).json({ message: 'User already exists' });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create new user
    const newUser = {
      id: db.users.length + 1,
      username,
      email,
      password: hashedPassword
    };
    
    db.users.push(newUser);
    
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Task 7: Login as a Registered user
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = db.users.find(user => user.email === email);
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }
    
    // Validate password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }
    
    // Create and assign token
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
    
    res.json({ 
      message: 'Logged in successfully',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Task 8: Add/Modify a book review (for registered users)
app.post('/api/books/:isbn/reviews', authenticateToken, (req, res) => {
  const { rating, comment } = req.body;
  const { isbn } = req.params;
  const userId = req.user.id;
  
  // Basic validation
  if (!rating || !comment) {
    return res.status(400).json({ message: 'Rating and comment are required' });
  }
  
  // Check if book exists
  const book = db.books.find(b => b.isbn === isbn);
  if (!book) {
    return res.status(404).json({ message: 'Book not found' });
  }
  
  // Check if user already reviewed this book
  const existingReviewIndex = db.reviews.findIndex(r => r.isbn === isbn && r.userId === userId);
  
  if (existingReviewIndex !== -1) {
    // Modify existing review
    db.reviews[existingReviewIndex] = {
      ...db.reviews[existingReviewIndex],
      rating,
      comment,
      updatedAt: new Date()
    };
    
    return res.json({ 
      message: 'Review updated successfully', 
      review: db.reviews[existingReviewIndex] 
    });
  }
  
  // Add new review
  const newReview = {
    id: db.reviews.length + 1,
    isbn,
    userId,
    username: req.user.username,
    rating,
    comment,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  db.reviews.push(newReview);
  
  res.status(201).json({ message: 'Review added successfully', review: newReview });
});

// Task 9: Delete book review added by that particular user
app.delete('/api/reviews/:reviewId', authenticateToken, (req, res) => {
  const { reviewId } = req.params;
  const userId = req.user.id;
  
  // Find review
  const reviewIndex = db.reviews.findIndex(r => r.id === parseInt(reviewId));
  
  if (reviewIndex === -1) {
    return res.status(404).json({ message: 'Review not found' });
  }
  
  // Check if user is the author of the review
  if (db.reviews[reviewIndex].userId !== userId) {
    return res.status(403).json({ message: 'Not authorized to delete this review' });
  }
  
  // Delete review
  const deletedReview = db.reviews.splice(reviewIndex, 1)[0];
  
  res.json({ message: 'Review deleted successfully', review: deletedReview });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// File: bookService.js
// Tasks 10-13: Node.JS program with 4 methods using Async/Await or Promises with Axios

const apiBaseUrl = 'http://localhost:3000/api';

// Task 10: Get all books – Using async callback function
async function getAllBooks(callback) {
  try {
    const response = await axios.get(`${apiBaseUrl}/books`);
    callback(null, response.data);
  } catch (error) {
    callback(error, null);
  }
}

// Task 11: Search by ISBN – Using Promises
function getBookByISBN(isbn) {
  return new Promise((resolve, reject) => {
    axios.get(`${apiBaseUrl}/books/isbn/${isbn}`)
      .then(response => resolve(response.data))
      .catch(error => reject(error));
  });
}

// Task 12: Search by Author
async function getBooksByAuthor(author) {
  try {
    const response = await axios.get(`${apiBaseUrl}/books/author/${author}`);
    return response.data;
  } catch (error) {
    throw error;
  }
}

// Task 13: Search by Title
async function getBooksByTitle(title) {
  try {
    const response = await axios.get(`${apiBaseUrl}/books/title/${title}`);
    return response.data;
  } catch (error) {
    throw error;
  }
}

module.exports = {
  getAllBooks,
  getBookByISBN,
  getBooksByAuthor,
  getBooksByTitle
};

// File: index.js
// Example usage of bookService.js

const bookService = require('./bookService');

// Example: Get all books
bookService.getAllBooks((error, books) => {
  if (error) {
    console.error('Error fetching books:', error.message);
  } else {
    console.log('All books:', books);
  }
});

// Example: Get book by ISBN
bookService.getBookByISBN('9780123456789')
  .then(book => console.log('Book by ISBN:', book))
  .catch(error => console.error('Error fetching book by ISBN:', error.message));

// Example: Get books by author
async function fetchBooksByAuthor() {
  try {
    const books = await bookService.getBooksByAuthor('John Developer');
    console.log('Books by author:', books);
  } catch (error) {
    console.error('Error fetching books by author:', error.message);
  }
}
fetchBooksByAuthor();

// Example: Get books by title
async function fetchBooksByTitle() {
  try {
    const books = await bookService.getBooksByTitle('Node');
    console.log('Books by title:', books);
  } catch (error) {
    console.error('Error fetching books by title:', error.message);
  }
}
fetchBooksByTitle();

// File: package.json
/*
{
  "name": "bookstore-api",
  "version": "1.0.0",
  "description": "A RESTful API for a bookstore using Node.js",
  "main": "app.js",
  "scripts": {
    "start": "node app.js",
    "dev": "nodemon app.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [
    "nodejs",
    "express",
    "api",
    "bookstore"
  ],
  "author": "",
  "license": "ISC",
  "dependencies": {
    "axios": "^1.6.2",
    "bcrypt": "^5.1.1",
    "body-parser": "^1.20.2",
    "express": "^4.18.2",
    "jsonwebtoken": "^9.0.2"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
*/

// File: README.md
/*
# Book Store API

A RESTful API for a bookstore built with Node.js and Express.

## Features

- Get all available books
- Search books by ISBN, author, or title
- User registration and authentication
- Review management (add, modify, delete)
- Client library with Promise and Async/Await examples

## Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Start the server: `npm start`
4. For development with auto-restart: `npm run dev`

## API Endpoints

### Books
- GET /api/books - Get all books
- GET /api/books/isbn/:isbn - Get book by ISBN
- GET /api/books/author/:author - Get books by author
- GET /api/books/title/:title - Get books by title
- GET /api/books/:isbn/reviews - Get reviews for a book

### Authentication
- POST /api/auth/register - Register a new user
- POST /api/auth/login - Login a user

### Reviews (Protected Routes)
- POST /api/books/:isbn/reviews - Add or modify a review
- DELETE /api/reviews/:reviewId - Delete a review

## Client Library

The `bookService.js` file provides methods to interact with the API:
- getAllBooks() - Using async callback
- getBookByISBN() - Using Promises
- getBooksByAuthor() - Using async/await
- getBooksByTitle() - Using async/await

## Example Usage

See `index.js` for examples of how to use the client library.
*/
