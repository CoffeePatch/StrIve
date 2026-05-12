
# 🎬 Strive - Your Personal Streaming Dashboard

Strive is a modern, feature-rich web application designed to be a personalized dashboard for movie and TV show enthusiasts. It goes beyond a typical streaming clone by focusing on powerful list management and providing a seamless viewing experience using multiple streaming sources. This project demonstrates a full-stack approach using React, Firebase, and the TMDB API to solve the problem of content discovery and organization.



## ⚡ Features

* **🔐 Secure Authentication:** User sign-up and login functionality powered by **Firebase Authentication**.
* **📚 Advanced List Management:**
    * **Personal Watchlist:** A default place to save content you want to watch later.
    * **Custom Lists:** Create, name, and manage an unlimited number of personal lists (e.g., "Favorite Comedies", "Mind-Bending Sci-Fi").
    * **Seamless Organization:** Add any movie or show to any of your lists directly from its details page.
* **🔄 Import & Export Lists:** Allow users to import and export their watchlist and viewing data in formats like CSV or JSON, giving them full control and portability of their data.
* **🎥 Dynamic Content Discovery:** Browse extensive lists of movies and TV shows, categorized into:
    * Now Playing, Popular, Top Rated, and Upcoming Movies.
    * On The Air, Popular, and Top Rated TV Shows.
* **🍿 Integrated Video Player:** Stream content directly within the app. The player intelligently falls back through multiple third-party streaming sources to ensure high availability.
* **🌟 meticulously Detailed Views:** Access comprehensive details for any movie or TV show, including synopsis, ratings, runtime, genres, and episode lists for series.
* **📚 Personalized Watchlists:** Add any movie or TV show to a personal "My List" which is saved to a **Firestore** database.
* **🔍 Universal Search:** A fully functional search bar to quickly find desired content.
* **📱 Fully Responsive Design:** A clean, modern UI built with **Tailwind CSS** that looks great on all devices.
* **⚙️ Centralized State Management:** Efficient and predictable state management using **Redux Toolkit**.

---

## 🚀 Future Enhancements

This project has a forward-looking roadmap to incorporate more advanced, user-centric features:

* **🤖 AI-Powered Recommendations:** Implement a recommendation engine to provide personalized movie and TV show suggestions based on a user's viewing history, ratings, and custom watchlist data.

* **👥 Social Features:** Introduce the ability to share custom lists with friends and discover new content based on their activity.

---

## 🛠️ Tech Stack

| Category           | Technology                                                                                                  |
| ------------------ | ----------------------------------------------------------------------------------------------------------- |
| **Frontend** | ![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black) ![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)                             |
| **Routing** | ![React Router](https://img.shields.io/badge/React_Router-CA4245?logo=react-router&logoColor=white)           |
| **State Management**| ![Redux](https://img.shields.io/badge/Redux_Toolkit-764ABC?logo=redux&logoColor=white)                      |
| **Styling** | ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white)          |
| **Backend & DB** | ![Firebase](https://img.shields.io/badge/Firebase-FFCA28?logo=firebase&logoColor=black) (Authentication, Firestore) |
| **API** | ![The Movie DB](https://img.shields.io/badge/TMDB_API-01B4E4?logo=themoviedatabase&logoColor=white)           |
| **Icons** | ![Lucide](https://img.shields.io/badge/Lucide-React-10B981)                                                  |
| **Deployment** | ![Firebase Hosting](https://img.shields.io/badge/Firebase_Hosting-FFA611?logo=firebase&logoColor=white)     |

---

## 📦 Installation & Setup Guide

Follow these steps to get the project running on your local machine.

**1. Clone the Repository:**

```bash
git clone https://github.com/al0nec0der/strive.git
cd strive
````

**2. Install Dependencies:**

```bash
npm install
```

**3. Set Up Environment Variables:**

Create a `.env` file in the root directory of the project and add the following keys. You will need to get these from the Firebase Console and The Movie Database (TMDB).

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY="YOUR_API_KEY"
VITE_FIREBASE_AUTH_DOMAIN="YOUR_AUTH_DOMAIN"
VITE_FIREBASE_PROJECT_ID="YOUR_PROJECT_ID"
VITE_FIREBASE_STORAGE_BUCKET="YOUR_STORAGE_BUCKET"
VITE_FIREBASE_MESSAGING_SENDER_ID="YOUR_MESSAGING_SENDER_ID"
VITE_FIREBASE_APP_ID="YOUR_APP_ID"
VITE_FIREBASE_MEASUREMENT_ID="YOUR_MEASUREMENT_ID"

# The Movie Database (TMDB) API Key
VITE_TMDB_KEY="Bearer YOUR_TMDB_READ_ACCESS_TOKEN"

# Streaming Service URLs (Optional, for player functionality)
VITE_RIVE_BASE_URL="https://your-url"
VITE_CINE_URL="https://your-url"
VITE_EMBED_URL="https://your-url"
VITE_MULTIEMD_URL="https://your-url"
VITE_VDSRC_URL="https://your-url"
```

**4. Run the Development Server:**

```bash
npm run dev
```

The application should now be running on `http://localhost:5173`.

-----

## 🚀 Deployment

This project is configured for easy deployment using **Firebase Hosting**.

**1. Install Firebase CLI:**

If you don't have it installed, run:

```bash
npm install -g firebase-tools
```

**2. Login to Firebase:**

```bash
firebase login
```

**3. Build the Project:**

Generate the production-ready build in the `dist` folder.

```bash
npm run build
```

**4. Deploy to Firebase:**

```bash
firebase deploy
```

Your application will be deployed to the URL provided by Firebase.

-----

## 🤝 Contributing

Contributions are welcome\! If you have suggestions for improvements or want to add new features, please feel free to fork the repository and submit a pull request.

1.  **Fork** the repository.
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`).
3.  **Commit** your changes (`git commit -m 'Add some AmazingFeature'`).
4.  **Push** to the branch (`git push origin feature/AmazingFeature`).
5.  Open a **Pull Request**.

-----

## 📜 License

This project is licensed under the MIT License. See the `LICENSE` file for more details.

-----

## 📞 Contact

  * **GitHub**: [github.com/al0nec0der](https://www.google.com/search?q=https://github.com/al0nec0der)
  * **LinkedIn**: [linkedin.com/in/codewithteja](https://linkedin.com/in/codewithteja)

<!-- end list -->
