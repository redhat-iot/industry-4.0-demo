/*
 * ******************************************************************************
 * Copyright (c) 2017 Red Hat, Inc. and others
 *
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *     Red Hat Inc. - initial API and implementation
 *
 * ******************************************************************************
 */
package com.redhat.iot.proxy.service;

import com.redhat.iot.proxy.model.Alert;
import com.redhat.iot.proxy.model.Line;
import org.apache.kafka.clients.consumer.ConsumerRebalanceListener;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.ConsumerRecords;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.common.TopicPartition;
import org.apache.kafka.common.errors.WakeupException;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.eclipse.paho.client.mqttv3.IMqttDeliveryToken;
import org.eclipse.paho.client.mqttv3.MqttCallback;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.json.JSONObject;

import javax.enterprise.context.ApplicationScoped;
import javax.enterprise.context.Destroyed;
import javax.enterprise.context.Initialized;
import javax.enterprise.event.Observes;
import javax.inject.Inject;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;

@ApplicationScoped
public class AlertsService implements MqttCallback {

    public static final int MAX_RECONNECT_ATTEMPTS = 100;
    public static final int NUM_CONSUMER_THREADS = 3;
    final private List<Alert> alerts = Collections.synchronizedList(new ArrayList<>());
    @Inject DGService dgService;

    public AlertsService() {

    }

    public void addAlert(Alert alert) {
        alerts.add(alert);
    }

    public List<Alert> getAlerts() {
        return alerts;
    }

    public void clearAlerts() {
        alerts.clear();
    }

    public void clearAlertsForLine(Line v) {
        synchronized (alerts) {
            List<Alert> toRemove = new ArrayList<>();
            for (Alert alert : alerts) {
                if (alert.getLine().getLid().equals(v.getLid())) {
                    toRemove.add(alert);
                }
            }
            for (Alert toRemoveAlert : toRemove) {
                alerts.remove(toRemoveAlert);
            }
        }
    }

    public void init(@Observes @Initialized(ApplicationScoped.class) Object init) {

        subscribeToAlerts();

    }

    public void destroy(@Observes @Destroyed(ApplicationScoped.class) Object init) {

        System.out.println("Destroying el bean");

    }

    // TODO
    private void subscribeToAlerts() {

        String hostname = System.getenv("KAFKA_ALERTS_HOST");
        String port = System.getenv("KAFKA_ALERTS_PORT");

        if (hostname == null || port == null) {
            throw new IllegalArgumentException("No KAFKA_* env properties set, cannot process alerts");
        }
        Properties props = new Properties();
        props.put("bootstrap.servers", hostname + ":" + port);
        props.put("group.id", "iot-demo-dashboard-proxy");
        props.put("enable.auto.commit", "true");
        props.put("auto.commit.interval.ms", "1000");
        props.put("key.deserializer", StringDeserializer.class.getName());
        props.put("value.deserializer", StringDeserializer.class.getName());

        String topicRegex = System.getenv("KAFKA_ALERTS_TOPIC_REGEX");

        ExecutorService executor = Executors.newFixedThreadPool(NUM_CONSUMER_THREADS);

        final List<ConsumerLoop> consumers = new ArrayList<>();
        for (int i = 0; i < NUM_CONSUMER_THREADS; i++) {
            ConsumerLoop consumer = new ConsumerLoop(props, topicRegex);
            consumers.add(consumer);
            executor.submit(consumer);
        }

        Runtime.getRuntime().addShutdownHook(new Thread() {
            @Override
            public void run() {
                System.out.println("Shutting down Kafka client");
                for (ConsumerLoop consumer : consumers) {
                    consumer.shutdown();
                }
                executor.shutdown();
                try {
                    System.out.println("waiting for executor shutdown");
                    executor.awaitTermination(5000, TimeUnit.MILLISECONDS);
                } catch (InterruptedException e) {
                    e.printStackTrace();
                }
            }
        });


        // TODO: deal with alerts from gateway
//        MemoryPersistence persistence = new MemoryPersistence();
//        String broker = "tcp://kapua-broker:1883";
//
//        for (int i = 0; i < MAX_RECONNECT_ATTEMPTS; i++) {
//            try {
//
//                MqttClient sampleClient = new MqttClient(broker, "dgproxy", persistence);
//
//                MqttConnectOptions connOpts = new MqttConnectOptions();
//                connOpts.setUserName(System.getenv("BROKER_USERNAME"));
//                connOpts.setPassword(System.getenv("BROKER_PASSWORD").toCharArray());
//
//                connOpts.setCleanSession(true);
//                System.out.println("Attempt " + (i+1) + " of " + MAX_RECONNECT_ATTEMPTS + ": Connecting to broker: " + broker);
//                sampleClient.connect(connOpts);
//                System.out.println("Connected");
//
//                sampleClient.setCallback(this);
//                sampleClient.subscribe("Red-Hat/+/iot-demo/+/+/alerts");
//
//                System.out.println("Subscribed");
//                break;
//            } catch (Exception me) {
//                System.out.println("Could not connect to " + broker);
//                System.out.println("msg " + me.getMessage());
//                System.out.println("loc " + me.getLocalizedMessage());
//                System.out.println("cause " + me.getCause());
//                System.out.println("excep " + me);
//                me.printStackTrace();
//            }
//            try {
//                System.out.println("Waiting for 10s to retry");
//                Thread.sleep(10000);
//            } catch (InterruptedException e) {
//                e.printStackTrace();
//            }
//        }
    }

    @Override
    public void connectionLost(Throwable throwable) {
        System.out.println("CONNECTION LOST");
        throwable.printStackTrace();
        System.out.println("Attempting to reconnect");
        //  TODO
        //  subscribeToAlerts();
    }

    private boolean isNull(String s) {
        return ((s == null) || (s.trim().isEmpty()) || s.trim().equalsIgnoreCase("null"));
    }

    private Long getLongObj(JSONObject dic, String key) {
        if (!dic.has(key) || dic.isNull(key)) {
            return null;
        } else {
            return dic.getLong(key);
        }
    }

    private String getStringObj(JSONObject dic, String key) {
        if (!dic.has(key) || dic.isNull(key)) {
            return null;
        } else {
            return dic.getString(key).trim();
        }
    }

    @Override
    public void messageArrived(String topic, MqttMessage mqttMessage) throws Exception {

        // TODO
//        String payload = mqttMessage.toString();
//
//        System.out.println("ALERT ARRIVED FOR TOPIC " + topic + " payload: " + payload);
//
//        JSONObject j = new JSONObject(payload);
//
//        Long dateObj = getLongObj(j, "date");
//        if (dateObj == null) {
//            dateObj = new Date().getTime();
//        }
//
//        Date date = new Date(dateObj);
//
//        String from = getStringObj(j, "from");
//        String desc = getStringObj(j, "desc");
//        String message = getStringObj(j, "message");
//        String type = getStringObj(j, "type");
//        String truck_id = getStringObj(j, "truckid");
//        String sensor_id = getStringObj(j, "sensorid");
//
//        if ("VEHICLE".equalsIgnoreCase(type)) {
//
//            Line v = dgService.getVehicles().get(truck_id.trim());
//            if (v == null) {
//                System.out.println("Cannot find vehicle " + truck_id + ", ignoring alert");
//                return;
//            }
//            v.setStatus("warning");
//            dgService.getVehicles().put(v.getVin(), v);
//            addAlert(new Alert(date, from, desc, message, type, truck_id, null));
//        } else if ("PACKAGE".equalsIgnoreCase(type)) {
//
//            Map<String, Shipment> shipCache = dgService.getShipments();
//
//            Shipment s = shipCache.get(sensor_id + "/" + truck_id);
//
//            if (s == null) {
//                System.out.println("Cannot find shipment for sensor_id=" + sensor_id + " truck_id=" + truck_id + ", ignoring alert");
//                return;
//            }
//
//            s.setStatus("warning");
//            dgService.getShipments().put(sensor_id + "/" + truck_id, s);
//            addAlert(new Alert(date, from, desc, message, type, truck_id, sensor_id));
//        } else {
//            System.out.println("Unknown alert type (" + type + "), ignoring");
//        }
    }

    @Override
    public void deliveryComplete(IMqttDeliveryToken iMqttDeliveryToken) {
        System.out.println("DELIVERY COMPLETE?");

    }
}

class ConsumerLoop implements Runnable {

    private final KafkaConsumer<String, String> consumer;

    private final String topicRegex;

    ConsumerLoop(Properties props, String topicRegex) {
        this.consumer = new KafkaConsumer<>(props);
        this.topicRegex = topicRegex;
    }

    @Override
    public void run() {
        try {
            consumer.subscribe(Pattern.compile(topicRegex), new ConsumerRebalanceListener() {
                @Override
                public void onPartitionsRevoked(Collection<TopicPartition> collection) {

                }

                @Override
                public void onPartitionsAssigned(Collection<TopicPartition> collection) {

                }
            });

            while (true) {
                ConsumerRecords<String, String> records = consumer.poll(Long.MAX_VALUE);
                for (ConsumerRecord<String, String> record : records) {
                    Map<String, Object> data = new HashMap<>();
                    data.put("partition", record.partition());
                    data.put("offset", record.offset());
                    data.put("value", record.value());
                    System.out.println("Message received: " + data);
                    //TODO deal with it
                }
            }
        } catch (WakeupException ignored) {
            System.out.println("WAKE UP CAUGHT");
        } finally {
            consumer.close();
        }
    }

    void shutdown() {
        consumer.wakeup();
    }
}
