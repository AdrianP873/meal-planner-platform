"""
Add a meal to the database.
"""

import boto3
import os
import logging

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

def handler(event, context):
    dynamodb = boto3.resource("dynamodb")
    
    DYNAMODB_TABLE = os.getenv('MEAL_TABLE')
    table = dynamodb.Table(DYNAMODB_TABLE)

    try:
        data = {
            "meal": event["meal"],
            "ingredients": event["ingredients"]
        }

        table.put_item(
            Item=data
        )

        logging.info("meal: {}, ingredients: {}".format(data["meal"], data["ingredients"]))
        logging.info({"data": data})

        return_status = 200
        return_body = {"message": "{} successfully added.".format(data["meal"])}
    except KeyError as e:
        logging.error(e)
        return_status = 400
        return_body = {"message": "missing data"}

    return {
        "statusCode": return_status,
        "body": return_body
    }
