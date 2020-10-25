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
    
    MEAL_TABLE = os.getenv(MEAL_TABLE)
    table = dynamodb.Table(MEAL_TABLE)

    data = event['body']

    try:
        table.put_item(
            Item={
                'meal': event["Meal"]
        )
     

    response =  dynamodb

    


    # Table already created. Get the Table and create an item


    logger.info("Creating table")

    print('test')



handler('test','sds')