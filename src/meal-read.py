"""
Retrieve all meals from database.
"""

import boto3
import os
import logging
import json

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

def handler(event, context):
    """ Handler function to process GET requests for meals """
    dynamodb = boto3.resource("dynamodb")
    
    DYNAMODB_TABLE = os.getenv('MEAL_TABLE')
    meal_table = dynamodb.Table(DYNAMODB_TABLE)

    # Scan all items in database
    meals = meal_table.scan(
        Select='ALL_ATTRIBUTES',
    )

    return_status = 200

    return {
        "statusCode": return_status,
        "body": meals["Items"]
    }

