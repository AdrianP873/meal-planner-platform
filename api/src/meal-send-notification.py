"""
Randomly selects 5 meals, generates a shopping list and sends SMS to user.
"""

import logging
import os
import random

import boto3
from twilio.rest import Client

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


def handler(event, context):
    """ Scans database, randomly selects 5 meals, generates a shopping list  """
    weekly_meal_count = 4
    dynamodb = boto3.resource("dynamodb")

    DYNAMODB_TABLE = os.getenv('MEAL_TABLE')
    meal_table = dynamodb.Table(DYNAMODB_TABLE)

    scan_meals = meal_table.scan(
        Select='ALL_ATTRIBUTES',
    )

    meals = scan_meals["Items"]

    meal_count = 0
    meal_list = []
    while meal_count < weekly_meal_count:
        select_meal = meals[random.randrange(len(meals))]
        meal_list.append(select_meal)
        meal_count += 1

    format_meals = ""

    for meal in meal_list:
        for ingredient, quantity in meal["ingredients"].items():
            format_meals += str(ingredient) + " : " + str(quantity) + "\n"

    print(format_meals)

    # Instantiate Twilio client and send sms
    account_sid = os.environ['TWILIO_ACCOUNT_SID']
    auth_token = os.environ['TWILIO_AUTH_TOKEN']
    client = Client(account_sid, auth_token)

    client.messages \
        .create(
            body=format_meals,
            from_=os.environ['TWILIO_PHONE'],
            to=os.environ['CUSTOMER_PHONE']
        )
