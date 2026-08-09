import json
import sys
import subprocess

with open("task-def.json", "r") as f:
    data = json.load(f)

task_def = data["taskDefinition"]
for container in task_def["containerDefinitions"]:
    if container["name"] == "frontend":
        if "secrets" not in container:
            container["secrets"] = []
        if not any(s["name"] == "AUTH_SECRET" for s in container["secrets"]):
            container["secrets"].append({
                "name": "AUTH_SECRET",
                "valueFrom": "arn:aws:ssm:ap-south-1:258975980340:parameter/share2me/prod/AUTH_SECRET"
            })
            print("Added AUTH_SECRET to frontend secrets")

for field in ["taskDefinitionArn", "revision", "status", "requiresAttributes", "compatibilities", "registeredAt", "registeredBy"]:
    task_def.pop(field, None)

with open("new-task-def.json", "w") as f:
    json.dump(task_def, f, indent=2)

print("Created new-task-def.json")
