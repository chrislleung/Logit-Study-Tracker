# 📚 Study Tracker

A powerful, offline-first React application designed to help students track study time, manage grades, and analyze their study efficiency. It features a fully customizable UI, predictive grade calculation, and persistent local storage.

## 🚀 Features

### ⏱️ Time Tracking
* **Live Timer:** Track study sessions in real-time for specific classes.
* **Session Logs:** View a history of all study sessions.
* **Log Management:** Manually add missed sessions, edit timestamps, or delete logs.
* **Totals:** View total study time per subject and for the entire semester.

### 📊 Analytics & Grades
* **Grade Tracker:** Record grades for assignments, exams, and quizzes.
* **Visual Analytics:** * **Efficiency Chart:** See how your grades correlate with time spent studying.
    * **Correlation Scatter Plot:** Identify trends in your study habits.
* **Predictive Calculator:** * Define custom assignment categories and weights (e.g., Exams 40%, Labs 20%).
    * Calculate current weighted average.
    * **"What do I need?"**: Enter a target grade to see exactly what score you need on remaining assignments.
    * **Time Prediction:** Uses regression analysis to estimate how many hours you need to study to achieve your target score.

### 🎨 Customization
* **Full Theming:** Customize the Primary (buttons), Accent (tabs/text), Background, and Text colors.
* **GIF Decorations:** Upload custom GIFs to display alongside the timer for motivation (or fun).
* **Layout Controls:** Adjust the size and spacing of your decorative GIFs directly in the settings.
* **Persisted Settings:** All theme preferences are saved automatically.

### 🔒 Privacy & Storage
* **Offline-First:** No accounts or internet connection required.
* **Local Database:** Uses **Dexie.js (IndexedDB)** to store all data directly in your browser. Your data never leaves your device.

---

## 🛠️ Tech Stack

* **Frontend:** React.js
* **Database:** Dexie.js (IndexedDB wrapper)
* **Charts:** Recharts
* **Styling:** CSS3 (with CSS Variables for theming)
* **Desktop Wrapper:** Electron (Optional, for Windows executable)

---

## 📦 Installation

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/yourusername/study-tracker.git](https://github.com/yourusername/study-tracker.git)
    cd study-tracker
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Start the development server:**
    ```bash
    npm start
    ```
    The app will open at `http://localhost:3000`.

---

## 🖥️ Building for Windows (Electron)

To package this app as a standalone Windows program (`.exe`):

1.  **Ensure Electron is installed:**
    ```bash
    npm install --save-dev electron electron-builder concurrently wait-on cross-env
    ```

2.  **Run in Desktop Mode (Development):**
    ```bash
    npm run electron:dev
    ```

3.  **Build the Installer:**
    ```bash
    npm run electron:build
    ```
    The `.exe` file will be generated in the `dist` folder.

---

## 📖 Usage Guide

### 1. Setting Up Classes
* Create a **New Semester** using the tab bar.
* Click **"Manage Classes"** (bottom right) to add your subjects (e.g., "Math 101", "History").

### 2. Tracking Time
* Select a class from the dropdown in the center of the screen.
* Click **Start Studying**. The timer will run even if you switch tabs.
* Click **Stop** to save the session to the history.
* *Forgot to timer?* Click **+ Add Log** to manually enter start/end times.

### 3. Calculating Grades
* Switch to the **Calculator** tab.
* Add **Categories** (e.g., "Homework", "Final") and assign their **Weights** (must sum to 100).
* Enter your grades in the list below.
* Enter your **Desired Grade** (e.g., 90) to see the required score for the rest of the semester.

### 4. Customizing the Look
* Click the **Gear Icon (⚙️)** in the top right.
* Use the color pickers to change the app's color scheme.
* Upload GIFs to personalize your dashboard.
* Use the **Size** and **Distance** sliders to fit the GIFs perfectly on your screen.

---

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

## 📄 License

[MIT](https://choosealicense.com/licenses/mit/)