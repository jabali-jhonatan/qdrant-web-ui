## run-vs: start the vector database (Qdrant) container
run-vs:
	docker run -it --rm \
	--name qdrant-web-vs \
	-p 6333:6333 -p 6334:6334 \
	-v "$(shell pwd)/tmp/qdrant_storage:/qdrant/storage:z" \
	qdrant/qdrant