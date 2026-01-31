# apothi.

A lightweight download frontend for your desktop applications.

## Features

- Application library with search, filter, and tag functionality
- Version management for each application with robust customization
- Multiple operating system and architecture support, with room for source
- Basic login authentication
- User management
- Quick Docker Compose deployment

## Screenshots

<a href="./media/preview_full_screen_player.png"><img src="./media/preview_full_screen_player.png" width="49.5%"/></a> <a href="./media/preview_album_artist_detail.png"><img src="./media/preview_album_artist_detail.png" width="49.5%"/></a> <a href="./media/preview_album_detail.png"><img src="./media/preview_album_detail.png" width="49.5%"/></a> <a href="./media/preview_smart_playlist.png"><img src="./media/preview_smart_playlist.png" width="49.5%"/></a>

## Deployment

Apothi is built strictly with Docker Compose in mind. Because this is (at the moment) a personal project, there won't be any other types of deployment for the foreseeable future.

Docker and Docker Compose, of course, are requirements to build and run Apothi.

## Quick Start

Clone the repository by running:
```bash
git clone https://github.com/jeffvli/feishin.git
```

In your favored directory for your Docker data.

To get Apothi up and running, you can use the following template.
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
		networks:
		  - default
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
		  - ./apothi/uploads:/app/uploads
			# For files on server accessed by directory
		  - ./apothi/files:/mnt/files:ro
		depends_on:
		  - postgres
		networks:
		  - default
		restart: unless-stopped

	  frontend:
		# Default admin login is admin:admin
		container_name: apothi-frontend
		build:
		  context: ./frontend
		  dockerfile: Dockerfile
		ports:
		  - "3000:80"
		environment:
		# DEBUG, INFO, and ERROR are levels you can use here. Recommended is ERROR.
		  - REACT_APP_LOG_LEVEL=ERROR
		depends_on:
		  - backend
		networks:
			- default
			- reverse_proxy
		restart: unless-stopped
```
Be sure to change the `SESSION_SECRET` in the backend to anything you like, as well as `POSTGRES_USER` and `POSTGRES_PASSWORD` to something more confidential. Be sure that, if you do, you also adapt `DATABASE_URL` to have the correct credentials.

There is no need for further configuration with Apothi. Just run `docker compose build` to get the image together, and `docker compose up` to get going.

### Default login credentials

By default, the admin login is simply:

```
Username: admin
Password: admin
```

You can change this immediately by going into the Admin Panel through the hamburger menu or by going to ``http://localhost:3000/admin``. 


## Usage

### For Regular Users

1. **Login** with your credentials
2. **Browse** the application library
3. **Search** for applications using the search bar
4. **Click** on an application to view available versions
5. **Download** the version you need (7z format)

### For Administrators

1. **Login** with admin credentials
2. **Click** "Admin Panel" in the header
3. **Manage Applications:**
   - Create new applications
   - Add versions to existing applications
   - Upload 7z files
   - Delete applications (and all their versions)
4. **Manage Users:**
   - Create new user accounts
   - Assign admin privileges

## Development

To run in development mode with hot reloading:

### Backend
```bash
cd backend
npm install
npm run dev
```

### Frontend
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

## License

This project is provided as-is for use in managing application distributions.

## Support

For issues and questions, please check the logs first:
```bash
docker-compose logs -f
```

Common issues are usually related to:
- Port conflicts (3000 and 3001 are common)
- Database initialization (sometimes needs a few minutes for migration or initialization on first run)
- File permissions (make sure your files are accesible by your Docker UID & GID)
