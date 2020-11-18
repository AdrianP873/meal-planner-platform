"""
Retrieve all meals from database.
"""

import json
import logging
import os
import boto3

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


def handler(event, context):
    dynamodb = boto3.resource("dynamodb")

    DYNAMODB_TABLE = os.getenv('MEAL_TABLE')
    meal_table = dynamodb.Table(DYNAMODB_TABLE)

    meals = meal_table.scan(
        Select='ALL_ATTRIBUTES',
    )

    return_status = 200
    return_body = meals["Items"]

    return {
        "statusCode": return_status,
        'headers': {
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'OPTIONS,GET',
            'Content-Type': 'application/json'
        },
        "body": json.dumps(return_body)
    }
