"""
Add a meal to the database.
"""

import boto3
import os
import logging
import json

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

def handler(event, context):
    dynamodb = boto3.resource("dynamodb")
    
    DYNAMODB_TABLE = os.getenv('MEAL_TABLE')
    meal_table = dynamodb.Table(DYNAMODB_TABLE)

    data = json.loads(event['body'])
    
    payload = {
        "meal": data["meal"],
        "ingredients": data["ingredients"]
    }

    meal_table.put_item(
        Item=data
    )

    logging.info("meal: {}, ingredients: {}".format(payload["meal"], payload["ingredients"]))
    logging.info({"data": payload})

    return_status = 200
    return_body = {"message": "{} successfully added.".format(payload["meal"])}

    return {
        "statusCode": return_status,
        'headers': {
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'OPTIONS,POST',
            'Content-Type': 'application/json',
        },
        "body": json.dumps(return_body)
    }
    
    
    
