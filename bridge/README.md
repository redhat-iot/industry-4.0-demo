# Cloudera Demo - MQTT to Kafka Bridge

This is a simple bridge between MQTT and Kafka, implemented using Camel MQTT and Kafka components. MQTT Topic names 
are mapped as message keys in Kafka.

In order to deploy this to Openshift, you must have a login to the demo Openshift instance on rhiot.org and a 
configured Openshift client on the build machine. The client must be logged in to the desired instance, ie. you can 
succesfully run `oc get pods`.

### Building

The example can be built with

    mvn clean install


### Running locally

The example can be run locally using the following Maven goal:

    mvn spring-boot:run


### Running the example in Openshift

Then the following command will package your app and run it on Openshift:

```
mvn fabric8:run
```

To list all the running pods:

    oc get pods

Then find the name of the pod that runs this quickstart, and output the logs from the running pods with:

    oc logs <name of pod>

