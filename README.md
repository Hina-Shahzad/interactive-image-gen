
# Interactive image gen


## Run Locally

Clone the project

```bash
  git clone https://github.com/Hina-Shahzad/interactive-image-gen
```

Go to the project directory

```bash
  cd interactive-image-gen
```

## Backend setup
1. ### Navigate to the Backend Directory

`` cd interactive_image_gen/backend ``

2. ### Create a Virtual Environment
Run the following command to create a virtual environment. This keeps all your Python dependencies isolated.

```` python -m venv venv ````

3. ### Activate the Virtual Environment
For Windows (Command Prompt or PowerShell)

``venv\Scripts\activate``

For macOS/Linux (or Git Bash on Windows):

``source venv/bin/activate``

4. ### Install Backend Dependencies
Once the virtual environment is activated, install the required dependencies for the backend.

Make sure you have a requirements.txt file in the backend/ folder with the following content:
````
Flask==2.2.2
Flask-CORS==3.0.10
werkzeug==2.2.2
matplotlib==3.7.1
numpy==1.24.3
pydantic==2.11.4
  ````

Now, install the dependencies:

``
pip install -r requirements.txt
``

5. ### Run the Flask Backend
Once the dependencies are installed, you can run the backend Flask server:
````
cd backend 
python mock_imaging.py 
````

## Frontend setup
1. ### Open a New Terminal Window
2. ### Navigate to the Frontend Directory

````
cd frontend
````
3. ### Install Frontend dependencies
````
 npm install 
 ````

4. ### Start the Frontend Server
````
npm run dev
````
This will start the frontend at ````http://localhost:5173 ````


