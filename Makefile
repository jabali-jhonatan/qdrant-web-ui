## run-vs: start the vector database (Qdrant) container
run-vs:
	docker run -it --rm \
	--name qdrant-web-vs \
	-p 6333:6333 -p 6334:6334 \
	-v "$(shell pwd)/tmp/qdrant_storage:/qdrant/storage:z" \
	qdrant/qdrant


## run-minio: start the minio container
run-minio:
	mkdir -p tmp/ia-gateway-data
	docker run -it --rm --platform linux/amd64 \
	--name qdrant-web-minio \
	-v "$(pwd)/tmp/ia-gateway-data:/data" \
	-p 9000:9000 -p 9001:9001 \
	quay.io/minio/minio:RELEASE.2025-05-24T17-08-30Z \
	server /data --console-address ":9001"