# CRYPTEX

# About
## Project Structure
The project is composed up of three parts:
* [backend/](backend/) The REST API built with Django.
* [frontend/](frontend/) The frontend built with React.
* [cryptexVM/](cryptexVM/) The Cryptex VM built with Zig.

# Running the Project
## Requirements

* The project uses Docker to build and run; installation instructions can be found at: https://docs.docker.com/get-started/get-docker/

## Executing

* (Optional) Build the docker container without running it
```
docker compose build
```
* Run the project
```
docker compose up --build
```
* Stop the project
```
docker compose stop
```
For more info see https://docs.docker.com/compose/
