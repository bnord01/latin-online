docker stop latin-o-c
docker rm latin-o-c
docker rmi latin-o
docker build -t latin-o .
docker run -d --name latin-o-c -p 3000:3000 latin-o
