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
package com.redhat.iot.proxy.rest;

import com.redhat.iot.proxy.model.Line;
import com.redhat.iot.proxy.model.Machine;
import com.redhat.iot.proxy.service.DGService;

import javax.inject.Inject;
import javax.inject.Singleton;
import javax.ws.rs.*;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * A simple REST service which proxies requests to a local datagrid.
 */

@Path("/machines")
@Singleton
public class MachinesEndpoint {

    @Inject
    DGService dgService;

    @GET
    @Path("/")
    @Produces({"application/json"})
    public List<Machine> getAll() {
        Map<String, Machine> cache = dgService.getMachines();
        return cache.keySet().stream()
                .map(cache::get)
                .collect(Collectors.toList());

    }
    @GET
    @Path("/{lid}")
    @Produces({"application/json"})
    public List<Machine> getByLine(@PathParam("lid") String lid) {

        Map<String, Line> lineCache = dgService.getProductionLines();

        return lineCache.get(lid).getMachines();
    }


}
