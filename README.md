# apothi.

A lightweight download frontend for your desktop applications.

## Features

- Application library with search, filter, and tag functionality
- Version management for each application with robust customization (Installer/Portable)
- Support for multiple operating systems and architectures, and source code
- Basic login authentication
- User management
- Quick Docker Compose deployment

* coming soon

## Screenshots

<a href="./media/library_preview.jpg"><img src="./media/library_preview.jpg" width="49.5%"/></a> <a href="./media/library_preview-list.jpg"><img src="./media/library_preview-list.jpg" width="49.5%"/></a> <a href="./media/admin-panel-preview.jpg"><img src="./media/admin-panel-preview.jpg" width="49.5%"/></a> <a href="./media/admin-panel-modal.jpg"><img src="./media/admin-panel-modal.jpg" width="49.5%"/></a>

## Deployment

Apothi is built strictly with Docker Compose in mind. Because this is (at the moment) a personal project, there won't be any other types of deployment for the foreseeable future.

Docker and Docker Compose, of course, are requirements to build and run Apothi.

## Quick Start

Clone the repository by running:
```bash
git clone https://github.com/callephi/apothi.git
```

To get Apothi up and running, you can use the following template (which is available as `docker-compose.example.yaml`, just rename to remove `example`).
```yaml
services:
  postgres:
    container_name: apothi-db
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: apothi
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: admin
    volumes:
      - ./postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  backend:
    container_name: apothi-backend
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - 3001:3001
    environment:
      DATABASE_URL: postgresql://admin:admin@postgres:5432/apothi
      SESSION_SECRET: CHANGE_ME_IMMEDIATELY
      NODE_ENV: production
    volumes:
        # For uploaded files
      - ./apothi:/app/uploads
        # For files on server accessed by directory
      - ./apothi/files:/mnt/files:ro
    depends_on:
      - postgres
    restart: unless-stopped

  frontend:
    # Default admin login is admin:admin
    container_name: apothi-frontend
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - 3000:80
    environment:
    # DEBUG, INFO, and ERROR are levels you can use here. Recommended is ERROR.
      - REACT_APP_LOG_LEVEL=INFO
    depends_on:
      - backend
    restart: unless-stopped
```
Be sure to change the `SESSION_SECRET` in the backend to anything you like, as well as `POSTGRES_USER` and `POSTGRES_PASSWORD` to something more confidential. Be sure that, if you do, you also adapt `DATABASE_URL` to have the correct credentials.

There is no need for further configuration with Apothi. Just run `docker compose build` to get the image together, and `docker compose up` to get going.

Apothi is now accessible via `http://localhost:3000`!

### Default login credentials

By default, the admin login is simply:

```
Username: admin
Password: admin
```

You can change this immediately by going into the Admin Panel through the hamburger menu or by going to ``http://localhost:3000/admin``. 


## Usage

### For Users

1. Browse the application library
2. Search for applications using the search bar
3. Customize app details (version, OS, arch) to their fitting if available
4. In-page download progress
5. Download extras like user data, readmes, etc.

### For Administrators

1. Login with admin credentials
2. Click "Admin Panel" in the hamburger mneu
3. Manage Applications:
   - Create new applications
   - Add versions to existing applications with OS, architecture, release date and more
   - Upload files
   - Upload extras like user data or other files
   - Delete applications (and all their versions)
4. Manage Users:
   - Create new user accounts
   - Modify display names
   - Assign admin privileges

## Development

To run in development mode with hot reloading:

#### Backend
```bash
cd backend
npm install
npm run dev
```

#### Frontend
```bash
cd frontend
npm install
npm start
```

## Development Stack

- **Backend:** Node.js, Express, PostgreSQL
- **Frontend:** React, React Router
- **Authentication:** Express Session
- **File Handling:** Multer
- **Image Processing**: Sharp

## Support

For issues and questions, please check the logs first:
```bash
docker-compose logs -f
```

Common issues are usually related to:
- Port conflicts (3000 and 3001 are common)
- Database initialization (sometimes needs a few minutes for migration or initialization on first run)
- File permissions (make sure your files are accesible by your Docker UID & GID)

Please also make sure that before submitting an issue, you view previous issues to ensure yours is unique.

## License

This project is provided as-is for use in managing application distributions. It is not for use of piracy or unauthorized redistribution either commercially or for non-profit, and by using Apothi, you agree that you are using it for personal use only.

# Disclaimer

Apothi is developed and maintained with AI assistance as this is largely a project for personal use.