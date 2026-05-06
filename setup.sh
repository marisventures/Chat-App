#!/bin/bash
# Setup script for Chat Application (Windows PowerShell compatible)

echo "=== Chat Application Setup ==="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

echo "✓ Node.js version: $(node -v)"

# Install root dependencies
echo ""
echo "Installing backend dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ Backend install failed"
    exit 1
fi

# Install frontend dependencies
echo ""
echo "Installing frontend dependencies..."
cd frontend
npm install
if [ $? -ne 0 ]; then
    echo "❌ Frontend install failed"
    exit 1
fi
cd ..

echo ""
echo "✓ Setup complete!"
echo ""
echo "=== Next Steps ==="
echo "1. Ensure MongoDB is running:"
echo "   - Local: net start MongoDB"
echo "   - Or Docker: docker run -d -p 27017:27017 mongo"
echo ""
echo "2. Configure environment variables if needed:"
echo "   - Root .env (backend)"
echo "   - frontend/.env (frontend)"
echo ""
echo "3. Start the application:"
echo "   Terminal 1: npm start           (backend on http://localhost:5000)"
echo "   Terminal 2: npm run dev:frontend (frontend on http://localhost:3000)"
echo ""
echo "Or run both with: npm run dev:all (requires 'concurrently' package)"
echo ""
echo "Happy coding! 🚀"
